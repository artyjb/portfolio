// === main.js ===
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let xScale, yScale;
let commits = [];
let hideTooltipTimeout;

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
    let first = lines[0];
    let { author, date, time, timezone, datetime } = first;

    let commitObject = {
      id: commit,
      url: 'https://github.com/artyjb/portfolio/commit/' + commit,
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };

    Object.defineProperty(commitObject, 'lines', {
      value: lines,
      enumerable: false,
      writable: false,
      configurable: false,
    });

    return commitObject;
  });
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  dl.append('dt').text('Number of files');
  dl.append('dd').text(d3.groups(data, d => d.file).length);

  const fileLengths = d3.rollups(data, v => d3.max(v, d => d.line), d => d.file);
  dl.append('dt').text('Longest file (in lines)');
  dl.append('dd').text(d3.max(fileLengths, d => d[1]));

  dl.append('dt').text('Average file length');
  dl.append('dd').text(d3.mean(fileLengths, d => d[1]).toFixed(2));

  dl.append('dt').text('Maximum depth');
  dl.append('dd').text(d3.max(data, d => d.depth));
}

function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;

  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-date').textContent = commit.datetime?.toLocaleDateString('en', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('commit-time').textContent = commit.time;
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

function isCommitSelected(selection, commit) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x0 <= x && x <= x1 && y0 <= y && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
  document.querySelector('#selection-count').textContent = `${selectedCommits.length || 'No'} commits selected`;
  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap(d => d.lines);
  const breakdown = d3.rollup(lines, v => v.length, d => d.type);
  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    container.innerHTML += `<dt>${language}</dt><dd>${count} lines (${d3.format('.1~%')(proportion)})</dd>`;
  }
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', d => isCommitSelected(selection, d));
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderScatterPlot(data, commitsData) {
  const sortedCommits = d3.sort(commitsData, d => -d.totalLines);
  const width = 1000, height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').append('svg').attr('viewBox', `0 0 ${width} ${height}`).style('overflow', 'visible');
  xScale = d3.scaleTime().domain(d3.extent(commitsData, d => d.datetime)).range([usableArea.left, usableArea.right]).nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);
  const [minLines, maxLines] = d3.extent(commitsData, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  svg.append('g').attr('class', 'gridlines').attr('transform', `translate(${usableArea.left}, 0)`).call(
    d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width)
  );

  svg.append('g').attr('class', 'dots').selectAll('circle')
    .data(sortedCommits).join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      clearTimeout(hideTooltipTimeout);
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      hideTooltipTimeout = setTimeout(() => updateTooltipVisibility(false), 50);
    });

  svg.append('g').attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale).ticks(10)).call(g => g.selectAll('text').style('font-size', '12px'));

  svg.append('g').attr('transform', `translate(${usableArea.left}, 0)`).call(
    d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2, '0') + ':00')
  ).call(g => g.selectAll('text').style('font-size', '12px'));

  createBrushSelector(svg);
}

const data = await loadData();
commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

const tooltip = document.getElementById('commit-tooltip');
tooltip.addEventListener('mouseenter', () => clearTimeout(hideTooltipTimeout));
tooltip.addEventListener('mouseleave', () => {
  hideTooltipTimeout = setTimeout(() => updateTooltipVisibility(false), 800);
});
