import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');
const projectsTitle = document.querySelector('.projects-title');

let colors = d3.scaleOrdinal(d3.schemeSet2);
let selectedIndex = -1;

function renderPieChart(projectsGiven) {
  const svg = d3.select('#projects-pie-plot');
  const legend = d3.select('.legend');

  svg.selectAll('*').remove();
  legend.selectAll('*').remove();

  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year
  ).sort((a, b) => a[0] - b[0]);

  if (rolledData.length === 0) return;

  const data = rolledData.map(([year, count]) => ({
    label: String(year),
    value: count
  }));

  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);
  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

  arcData.forEach((d, i) => {
    svg.append('path')
      .attr('d', arcGenerator(d))
      .attr('fill', colors(i))
      .attr('class', selectedIndex === i ? 'selected' : '')
      .style('cursor', 'pointer')
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;

        svg.selectAll('path')
          .attr('class', (_, idx) => selectedIndex === idx ? 'selected' : '');

        legend.selectAll('li')
          .attr('class', (_, idx) => selectedIndex === idx ? 'legend-item selected' : 'legend-item');

        if (selectedIndex === -1) {
          renderProjects(projectsGiven, projectsContainer, 'h3');
        } else {
          const selectedYear = data[selectedIndex].label;
          const filteredByYear = projectsGiven.filter(
            (project) => String(project.year) === selectedYear
          );
          renderProjects(filteredByYear, projectsContainer, 'h3');
        }
      });
  });

  data.forEach((d, idx) => {
    legend.append('li')
      .attr('style', `--color:${colors(idx)}`)
      .attr('class', selectedIndex === idx ? 'legend-item selected' : 'legend-item')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => {
        selectedIndex = selectedIndex === idx ? -1 : idx;

        svg.selectAll('path')
          .attr('class', (_, i) => selectedIndex === i ? 'selected' : '');

        legend.selectAll('li')
          .attr('class', (_, i) => selectedIndex === i ? 'legend-item selected' : 'legend-item');

        if (selectedIndex === -1) {
          renderProjects(projectsGiven, projectsContainer, 'h3');
        } else {
          const selectedYear = data[selectedIndex].label;
          const filteredByYear = projectsGiven.filter(
            (project) => String(project.year) === selectedYear
          );
          renderProjects(filteredByYear, projectsContainer, 'h3');
        }
      });
  });

  const visibleCount =
    selectedIndex === -1
      ? projectsGiven.length
      : projectsGiven.filter(
        (p) => String(p.year) === data[selectedIndex].label
      ).length;

  projectsTitle.textContent = `${visibleCount} Projects`;
}

// Initial render
renderProjects(projects, projectsContainer, 'h3');
renderPieChart(projects);

searchInput.addEventListener('input', (event) => {
  let query = event.target.value.toLowerCase().trim();

  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query);
  });

  renderProjects(filteredProjects, projectsContainer, 'h3');
  renderPieChart(filteredProjects);
});


