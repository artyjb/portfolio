import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects.slice(0, 3);
const projectsContainer = document.querySelector('.projects');
renderProjects(latestProjects, projectsContainer, 'h3');

const githubData = await fetchGitHubData('artyjb');

const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
    profileStats.innerHTML = `
        <div class="stat">
            <div class="number">${githubData.public_repos}</div>
            <div class="label">Public Repos</div>
        </div>
        <div class="stat">
            <div class="number">${githubData.public_gists}</div>
            <div class="label">Public Gists</div>
        </div>
        <div class="stat">
            <div class="number">${githubData.followers}</div>
            <div class="label">Followers</div>
        </div>
        <div class="stat">
            <div class="number">${githubData.following}</div>
            <div class="label">Following</div>
        </div>
    `;
}