import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.1.1/+esm';

async function fetchCommitData() {
  const raw = await d3.csv('loc.csv', row => ({
    ...row,
    lineNum: +row.line,
    indent: +row.depth,
    charLength: +row.length,
    localDate: new Date(row.date + 'T00:00' + row.timezone),
    timestamp: new Date(row.datetime)
  }));
  return raw;
}

function parseCommitGroups(raw) {
  return d3.groups(raw, d => d.commit).map(([hash, lines]) => {
    const base = lines[0];
    const summary = {
      hash,
      user: base.author,
      time: base.timestamp,
      readableDate: base.date,
      readableTime: base.time,
      zone: base.timezone,
      githubURL: `https://github.com/elinalebuff/lab1_dsc106/commit/${hash}`,
      hourDecimal: base.timestamp.getHours() + base.timestamp.getMinutes() / 60,
      locCount: lines.length,
    };
    Object.defineProperty(summary, 'lines', {
      value: lines,
      enumerable: false
    });
    return summary;
  });
}

function showCommitStats(raw, grouped) {
  const section = d3.select('#metrics').html('');

  const stats = [
    { label: 'Lines of Code', value: raw.length },
    { label: 'Commits', value: grouped.length },
    { label: 'Files', value: d3.groups(raw, d => d.file).length },
    { label: 'Max Line Length', value: d3.max(raw, d => d.charLength) + ' chars' },
    { label: 'Avg Line Length', value: d3.mean(raw, d => d.charLength).toFixed(1) + ' chars' }
  ];

  stats.forEach(({ label, value }) => {
    const div = section.append('div').attr('class', 'metric');
    div.append('div').attr('class', 'label').text(label);
    div.append('div').attr('class', 'value').text(value);
  });
}

function renderFileList(filteredCommits) {
  const colors = d3.scaleOrdinal(d3.schemeSet2);

  let allLines = filteredCommits.flatMap(d => d.lines);
  let grouped = d3.groups(allLines, d => d.file).map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesDiv = d3.select('#files')
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('align-items', 'flex-start')
    .style('row-gap', '10px');

  const items = filesDiv.selectAll('div').data(grouped, d => d.name).join(
    enter => enter.append('div')
      .style('opacity', 0)
      .style('transform', 'translateY(12px)')
      .call(div => {
        div.append('dt').append('code');
        div.append('dd').attr('class', 'line-count');
        div.append('dd').attr('class', 'lines');
      })
      .transition()
      .duration(400)
      .style('opacity', 1)
      .style('transform', 'translateY(0)')
  );

  items.style('--color', d => colors(d.lines[0]?.type));

  items.select('dt > code').text(d => d.name);
  items.select('dd.line-count').text(d => `${d.lines.length} lines`);
  items.select('dd.lines')
    .selectAll('div')
    .data(d => d.lines, d => d.lineNum)
    .join(
      enter => enter.append('div')
        .attr('class', 'loc')
        .style('background', 'var(--color)')
        .style('opacity', 0)
        .transition().duration(300).style('opacity', 1),
      update => update,
      exit => exit.transition().duration(300).style('opacity', 0).remove()
    );
}

function drawScatter(commits) {
  // Only set up chart once — don't delete everything each time
  const svg = d3.select('#viz').selectAll('svg').data([null])
    .join('svg')
    .attr('viewBox', '0 0 960 600');

  const x = d3.scaleTime().domain(d3.extent(commits, d => d.time)).range([60, 900]);
  const y = d3.scaleLinear().domain([0, 24]).range([580, 20]);
  const r = d3.scaleSqrt().domain(d3.extent(commits, d => d.locCount)).range([2, 30]);

  // Save for later use
  drawScatter._x = x;
  drawScatter._y = y;
  drawScatter._r = r;

  // Axis setup only once
  if (svg.selectAll('.x-axis').empty()) {
    svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', 'translate(0,580)')
      .call(d3.axisBottom(x));

    svg.append('g')
      .attr('class', 'y-axis')
      .attr('transform', 'translate(60,0)')
      .call(d3.axisLeft(y).tickFormat(d => `${String(d).padStart(2, '0')}:00`));
  }

  // Plot points once
  svg.selectAll('.dots')
    .data([null])
    .join('g')
    .attr('class', 'dots')
    .selectAll('circle')
    .data(commits, d => d.hash)
    .join(
      enter => enter.append('circle')
        .attr('cx', d => x(d.time))
        .attr('cy', d => y(d.hourDecimal))
        .attr('r', 0)
        .attr('fill', '#4577b6')
        .attr('opacity', 0)
        .on('mouseenter', (e, d) => {
          d3.select('#tooltip-content').html(
            `<strong>Commit:</strong> <a href="${d.githubURL}" target="_blank">${d.hash}</a><br>` +
            `<strong>Date:</strong> ${d.time.toLocaleString()}<br>` +
            `<strong>Author:</strong> ${d.user}<br>` +
            `<strong>Lines:</strong> ${d.locCount}`
          );
          d3.select('#tooltip').style('display', 'block');
        })
        .on('mousemove', (e) => {
          d3.select('#tooltip')
            .style('left', e.pageX + 'px')
            .style('top', (e.pageY - 20) + 'px');
        })
        .on('mouseleave', () => d3.select('#tooltip').style('display', 'none'))
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr('r', d => r(d.locCount))
        .attr('opacity', 0.7),

      update => update,  // No need to animate here; handled by slider

      exit => exit.transition().duration(300).attr('opacity', 0).remove()
    );

  // Brush setup
  const brush = d3.brush().on('brush end', (event) => handleBrush(event, commits, x, y));
  svg.call(brush);
}



function handleBrush(event, commits, xScale, yScale) {
  const sel = event.selection;
  d3.selectAll('circle').classed('selected', d => isBrushed(d, sel, xScale, yScale));

  const brushed = sel ? commits.filter(d => isBrushed(d, sel, xScale, yScale)) : [];

  document.querySelector('#selection-count').textContent =
    `${brushed.length || 'No'} commits selected`;

  const lines = brushed.flatMap(d => d.lines);
  const summary = d3.rollup(lines, v => v.length, d => d.type);

  const container = document.getElementById('language-breakdown');
  container.innerHTML = '';
  for (const [lang, count] of summary) {
    const percent = d3.format('.1%')(count / lines.length);
    container.innerHTML += `<dt>${lang}</dt><dd>${count} lines (${percent})</dd>`;
  }
}

function isBrushed(commit, selection, xScale, yScale) {
  if (!selection) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const cx = xScale(commit.time);
  const cy = yScale(commit.hourDecimal);
  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

function setupSlider(commits, timeScale) {
  let sliderValue = 100;
  const slider = document.getElementById('slider');
  const label = document.getElementById('commit-time');

  function update() {
    const cutoff = timeScale.invert(sliderValue);
    const visible = commits.filter(d => d.time <= cutoff);

    label.textContent = cutoff.toLocaleString('en', { dateStyle: 'long', timeStyle: 'short' });
    drawScatter(visible);
    renderFileList(visible);
  }

  slider.addEventListener('input', e => {
    sliderValue = +e.target.value;
    update();
  });

  update();
}

function generateCommitStory(commits) {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html((d, i) => `
      <p>On ${d.time.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short'
    })}, I made 
      <a href="${d.githubURL}" target="_blank">
        ${i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'}
      </a>. I edited ${d.locCount} lines across ${d3.groups(d.lines, v => v.file).length} files. Then I looked over all I had made, and I saw that it was very good.</p>
    `);
}

const rawData = await fetchCommitData();
const parsedCommits = parseCommitGroups(rawData);
const timeScale = d3.scaleTime().domain(d3.extent(parsedCommits, d => d.time)).range([0, 100]);

showCommitStats(rawData, parsedCommits);
drawScatter(parsedCommits);
renderFileList(parsedCommits);
generateCommitStory(parsedCommits);
setupSlider(parsedCommits, timeScale);

const observer = scrollama();
observer.setup({ step: '.step', offset: 0.5 }).onStepEnter(resp => {
  d3.selectAll('circle').classed('highlight', d => d.hash === parsedCommits[resp.index].hash).raise();
  renderFileList(parsedCommits.filter(d => d.time <= parsedCommits[resp.index].time));
});