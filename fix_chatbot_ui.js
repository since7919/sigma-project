const fs = require('fs');

let chatbotJs = fs.readFileSync('SIGMA_SIM/js/chatbot_advanced.js', 'utf8');

// Fix STATE reference
chatbotJs = chatbotJs.replace(
    "const data = (typeof window.STATE !== 'undefined' && window.STATE.junctions) ? Object.values(window.STATE.junctions) : [];",
    "const data = (typeof STATE !== 'undefined' && STATE.junctions) ? Object.values(STATE.junctions) : [];"
);

// Add cute robot SVG
const cuteRobotSVG = `
<svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C10.8954 2 10 2.89543 10 4V4.5C6.96243 4.5 4.5 6.96243 4.5 10V18C4.5 19.1046 5.39543 20 6.5 20H17.5C18.6046 20 19.5 19.1046 19.5 18V10C19.5 6.96243 17.0376 4.5 14 4.5V4C14 2.89543 13.1046 2 12 2Z" fill="#fff"/>
  <path d="M7 10C7 8.89543 7.89543 8 9 8H15C16.1046 8 17 8.89543 17 10V12C17 13.1046 16.1046 14 15 14H9C7.89543 14 7 13.1046 7 12V10Z" fill="#0f172a"/>
  <circle cx="10" cy="11" r="1.5" fill="#00d4ff"/>
  <circle cx="14" cy="11" r="1.5" fill="#00d4ff"/>
  <path d="M10 17H14" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
  <path d="M2.5 11C1.67157 11 1 11.6715 1 12.5C1 13.3284 1.67157 14 2.5 14H4.5V11H2.5Z" fill="#fff"/>
  <path d="M21.5 11C22.3284 11 23 11.6715 23 12.5C23 13.3284 22.3284 14 21.5 14H19.5V11H21.5Z" fill="#fff"/>
  <path d="M12 2C12.5523 2 13 2.44772 13 3C13 3.55228 12.5523 4 12 4C11.4477 4 11 3.55228 11 3C11 2.44772 11.4477 2 12 2Z" fill="#0f172a"/>
</svg>
`;

chatbotJs = chatbotJs.replace(
    '🤖',
    cuteRobotSVG
);

fs.writeFileSync('SIGMA_SIM/js/chatbot_advanced.js', chatbotJs, 'utf8');
console.log('Fixed STATE reference and updated robot icon');
