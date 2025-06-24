console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Define the base path for local and production environments
const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/"                  // Local server
  : "/portfolio/";         // GitHub Pages repo name

// Define the pages for navigation
let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact Me' },
  { url: 'resume/', title: 'Resume' },

  { url: 'https://github.com/artyjb/', title: 'GitHub' }
];

// Create the navigation element
let nav = document.createElement('nav');
document.body.prepend(nav);

// Insert navigation links and highlight the current page
for (let p of pages) {
  let url = p.url;
  let title = p.title;

  // Adjust the URL for relative paths
  if (!url.startsWith('http')) {
    url = BASE_PATH + url;
  }

  // Create the link element
  let link = document.createElement('a');
  link.href = url;
  link.textContent = title;

  // Open external links in a new tab
  if (url.startsWith('http')) {
    link.target = '_blank';
  }

  // Highlight the current page link
  if (link.host === location.host && link.pathname === location.pathname) {
    link.classList.add('current');
  }

  // Append the link to the navigation
  nav.appendChild(link);
}

// Add the dark mode switch to the start of the <body>
document.body.insertAdjacentHTML(
  'afterbegin',
  `
    <label class="color-scheme">
        Theme:
        <select id="theme-switch">
            <option value="light dark">Automatic</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>
`);

// Handle theme changes
const themeSwitch = document.getElementById('theme-switch');

// Load the saved theme from localStorage (if any)
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.style.colorScheme = savedTheme;
  themeSwitch.value = savedTheme;
}

// Listen for changes to the dropdown menu
themeSwitch.addEventListener('change', (event) => {
  const selectedTheme = event.target.value;

  // Set the color-scheme property on the root element
  document.documentElement.style.colorScheme = selectedTheme;

  // Save the selected theme to localStorage
  localStorage.setItem('theme', selectedTheme);
});

export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    // Log the response object to the console
    console.log(response);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  containerElement.innerHTML = ''; // Clear the container

  if (!projects || projects.length === 0) {
    containerElement.innerHTML = '<p>No projects available at the moment.</p>';
    return;
  }

  projects.forEach(project => {
    const article = document.createElement('article');
    article.innerHTML = `
      <${headingLevel}>${project.title}</${headingLevel}>
      ${project.link
        ? `<a href="${project.link}" target="_blank" rel="noopener noreferrer">
               <img src="${project.image}" alt="${project.title}">
             </a>`
        : `<img src="${project.image}" alt="${project.title}">`
      }
      <p>${project.description}</p>

      <div class="project-meta">
        <p>${project.description}</p>
        <p class="project-year">${project.year}</p>
      </div>
    `;
    containerElement.appendChild(article);
  });
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}