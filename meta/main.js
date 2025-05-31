import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

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
function onTimeSliderChange() {
  const slider = document.getElementById('commit-progress');
  commitProgress = +slider.value;
  commitMaxTime = timeScale.invert(commitProgress);

  // Update the time element
  const timeEl = document.getElementById('commit-time');
  timeEl.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  // Prepare filtered commits
  const filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);

  // Re-render scatter plot (we’ll refine this in the next step)
  updateScatterPlot(filteredCommits);

  // Update file display
  updateFileDisplay(filteredCommits);
}

function updateFileDisplay(filteredCommits) {
  const colors = d3.scaleOrdinal(d3.schemeTableau10);

  let lines = filteredCommits.flatMap(d => d.lines);
  let files = d3.groups(lines, d => d.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  // Ensure #files container stretches and aligns items to top
  d3.select('#files')
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('align-items', 'flex-start')
    .style('justify-content', 'flex-start')
    .style('row-gap', '10px')
    .style('min-height', '100%');

  const filesContainer = d3.select('#files')
    .selectAll('div')
    .data(files, d => d.name)
    .join(
      // Enhanced enter: animate in with fade and upward shift
      enter => enter.append('div')
        .style('opacity', 0)
        .style('transform', 'translateY(12px)')
        .style('margin-bottom', '12px')
        .call(div => {
          div.append('dt').append('code');
          div.append('dd').attr('class', 'line-count');
          div.append('dd').attr('class', 'lines');
        })
        .transition()
        .duration(500)
        .ease(d3.easeCubicOut)
        .style('opacity', 1)
        .style('transform', 'translateY(0px)'),
      update => update,
      exit => exit.remove()
    );

  filesContainer.style('--color', d => colors(d.lines[0]?.type));

  filesContainer.select('dt > code')
    .transition()
    .duration(400)
    .text(d => d.name);

  filesContainer.select('dd.line-count')
    .transition()
    .duration(400)
    .tween('text', function (d) {
      const i = d3.interpolateNumber(+this.textContent.split(' ')[0] || 0, d.lines.length);
      return t => this.textContent = `${Math.round(i(t))} lines`;
    });

  filesContainer.select('dd.lines')
    .selectAll('div')
    .data(d => d.lines, d => d.line)
    .join(
      enter => enter.append('div')
        .attr('class', 'loc')
        .style('background', 'var(--color)')
        .style('opacity', 0)
        .transition()
        .duration(300)
        .style('opacity', 1),
      update => update,
      exit => exit.transition().duration(300).style('opacity', 0).remove()
    );
}
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;

      let ret = {
        id: commit,
        url: 'https://github.com/elinalebuff/lab1_dsc106/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of Code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  dl.append('dt').text('Files');
  dl.append('dd').text(d3.groups(data, d => d.file).length);

  const longestLine = d3.max(data, d => d.length);
  dl.append('dt').text('Longest line length');
  dl.append('dd').text(longestLine + ' characters');

  const avgLength = d3.mean(data, d => d.length);
  dl.append('dt').text('Average line length');
  dl.append('dd').text(avgLength.toFixed(1) + ' characters');
}

function renderTooltipContent(commit) {
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-link').href = commit.url;

  document.getElementById('commit-date').textContent = commit.date.toLocaleDateString();
  document.getElementById('commit-time').textContent = commit.datetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY - 8}px`;
}

function renderScatterPlot(commits) {
  d3.select('#chart').selectAll('*').remove();
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);

  const rScale = d3.scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  const svg = d3.select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Grid lines
  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickFormat('')
        .tickSize(-usableArea.width)
    );

  // Axes
  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale));

  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2, '0') + ':00'));

  // Sort commits so smaller circles are drawn last (on top)
  const sortedCommits = d3.sort(commits, d => -d.totalLines);

  const dots = svg.append('g').attr('class', 'dots');

  dots.selectAll('circle')
    .data(sortedCommits, d => d.id)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, d) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', (event) => {
      // Delay hiding to allow checking if we hovered the tooltip
      setTimeout(() => {
        const tooltip = document.getElementById('commit-tooltip');
        const isHoveringTooltip = tooltip.matches(':hover');
        if (!isHoveringTooltip) {
          updateTooltipVisibility(false);
        }
      }, 100);
    });

  // Brushing
  const brush = d3.brush()
    .on('start brush end', (event) => brushed(event, commits, xScale, yScale));

  svg.call(brush);
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function updateScatterPlot(commits) {
  const svg = d3.select('#chart').select('svg');

  // Preserve axis and structure, do not remove all elements
  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([50, 950])
    .nice();

  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([600 - 30, 10]);

  const rScale = d3.scaleSqrt()
    .domain(d3.extent(commits, d => d.totalLines))
    .range([2, 30]);

  const sortedCommits = d3.sort(commits, d => -d.totalLines);

  // Replace x-axis update logic
  const xAxisGroup = svg.select('.x-axis');
  xAxisGroup.transition().duration(300).call(d3.axisBottom(xScale));

  const dots = svg.select('g.dots');

  // Update circles, use .attr() before .transition() for smoothness
  const joined = dots.selectAll('circle')
    .data(sortedCommits, d => d.id)
    .join(
      enter => enter.append('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', 0)
        .attr('fill', 'steelblue')
        .style('opacity', 0)
        .style('display', 'inline')
        .call(enter => enter.transition()
          .duration(300)
          .attr('r', d => rScale(d.totalLines))
          .style('opacity', 0.7)),
      update => update
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .style('opacity', 0.7)
        .style('display', 'inline')
        .transition()
        .duration(300),
      exit => exit.transition().duration(20).style('opacity', 0).remove()
    );

  // Update .raise() to only affect highlighted circles and avoid interfering with layout prematurely
  joined.filter(function (d) { return d3.select(this).classed('highlight'); }).raise();
}

function isCommitSelected(selection, commit, xScale, yScale) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const cx = xScale(commit.datetime);
  const cy = yScale(commit.hourFrac);
  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

function renderSelectionCount(selection, commits, xScale, yScale) {
  const selectedCommits = selection
    ? commits.filter(d => isCommitSelected(selection, d, xScale, yScale))
    : [];

  document.querySelector('#selection-count').textContent =
    `${selectedCommits.length || 'No'} commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection, commits, xScale, yScale) {
  const selectedCommits = selection
    ? commits.filter(d => isCommitSelected(selection, d, xScale, yScale))
    : [];

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
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

function brushed(event, commits, xScale, yScale) {
  const selection = event.selection;

  d3.selectAll('circle')
    .classed('selected', d => isCommitSelected(selection, d, xScale, yScale));

  renderSelectionCount(selection, commits, xScale, yScale);
  renderLanguageBreakdown(selection, commits, xScale, yScale);
}

// Load and render everything
let data = await loadData();
let commits = processCommits(data);

let commitProgress = 100;

const timeScale = d3
  .scaleTime()
  .domain(d3.extent(commits, d => d.datetime))
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);

renderCommitInfo(data, commits);
renderScatterPlot(commits);

document.getElementById('commit-tooltip').addEventListener('mouseleave', () => {
  updateTooltipVisibility(false);
});

// Time slider event logic (moved here to avoid recursion)
document.getElementById('commit-progress').addEventListener('input', onTimeSliderChange);
onTimeSliderChange(); // run once on load

// Generate narrative paragraph for each commit in #scatter-story
d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
      <p>On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short'
    })}, I made 
      <a href="${d.url}" target="_blank">
        ${i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'}
      </a>. I edited ${d.totalLines} lines across ${d3.rollups(d.lines, v => v.length, d => d.file).length
      } files. Then I looked over all I had made, and I saw that it was very good.</p>
    `
  );

// --- Scrollama interaction for highlighting dots on narrative scroll ---
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.1.1/+esm';

const scroller = scrollama();

let debounceTimeout;
function onStepEnter(response) {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    const stepCommit = commits[response.index];
    d3.selectAll('circle')
      .classed('highlight', d => d.id === stepCommit.id)
      .raise();
    const filteredCommits = commits.filter(d => d.datetime <= stepCommit.datetime);
    updateFileDisplay(filteredCommits);
  }, 20);
}

scroller
  .setup({
    step: '.step',
    offset: 0.5,
    debug: false,
  })
  .onStepEnter(onStepEnter)
  .onStepExit(() => {
    d3.selectAll('circle').classed('highlight', false);
  });

// --- Scroll sync behavior for left and right columns ---
const rightColumn = document.getElementById('right-column');
const leftColumn = document.getElementById('left-column');

if (rightColumn && leftColumn) {
  rightColumn.addEventListener('scroll', () => {
    const rightScrollRatio = rightColumn.scrollTop / (rightColumn.scrollHeight - rightColumn.clientHeight);
    const leftScrollHeight = leftColumn.scrollHeight - leftColumn.clientHeight;
    leftColumn.scrollTop = rightScrollRatio * leftScrollHeight;
  });
}