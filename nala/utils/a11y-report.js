/* eslint-disable no-nested-ternary */

import path from 'node:path';
import { promises as fs } from 'fs';

// Function to escape HTML characters for safe display
function escapeHTML(html) {
  return html.replace(/[&<>'"]/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case "'": return '&#39;';
      case '"': return '&quot;';
      default: return char;
    }
  });
}

export default async function generateA11yReport(report, outputDir) {
  const time = new Date();
  const reportName = `nala-a11y-report-${time
    .toISOString()
    .replace(/[:.]/g, '-')}.html`;

  const isGitHubAction = process.env.GITHUB_ACTIONS === 'true';
  const reportPath = isGitHubAction
    ? path.resolve(process.env.REPORT_DIR, reportName) // Use GitHub report directory
    : path.resolve(outputDir, reportName);

  // Check if the report contains violations
  if (!report || report.length === 0) {
    console.error('No accessibility violations to report.');
    return;
  }

  const testRunType = isGitHubAction
    ? 'GitHub Action Run'
    : process.env.CIRCLECI
    ? 'CircleCI Env Run'
    : 'Local Run';

  const triggeredBy = isGitHubAction
    ? process.env.GITHUB_ACTOR || 'unknown'
    : 'Nala QE';
  
  const totalViolations = report.reduce(
    (sum, result) => sum + (result.violations ? result.violations.length : 0),
    0
  );

  // Inline CSS for the report
  const inlineCSS = `
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
        margin: 20px; 
        background-color: #f9f9f9; 
        color: #333;
      }
      h1 {
        font-size: 2.5em;
        text-align: center;
        margin-bottom: 20px;
        color: #003366;
      }
      .metadata-container {
        background-color: #e6f2ff;
        background: linear-gradient(135deg, #e6f2ff, #cce0ff);
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        margin-bottom: 30px;
        text-align: left;
        font-size: 1em;
        color: #333;
      }
      .metadata-container span {
        display: inline-block;
        width: 150px; /* Adjust this width as necessary */
        font-weight: bold;
        color: #003366;
      }
      .metadata-container p {
        margin: 0;
        padding: 5px 0;
      }
      .metadata-container p:hover {
        background-color: #f1f8ff;
        border-radius: 5px;
      }
      .icon {
        margin-right: 10px;
        color: #006699;
      }        
      .section-header {
        background-color: #f0f0f0;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }
      .section-header h2 {
        margin: 0;
        color: #006699;
        font-size: 1.4em;
      }
      .section-header p {
        font-size: 1em;
        color: #333;
        margin: 5px 0;
      }
      .violation-section {
        background-color: #ffffff;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        margin-bottom: 30px;
      }
      table { 
        width: 100%; 
        border-collapse: collapse; 
        margin: 20px 0; 
        background-color: #fff; 
        border: 1px solid #ddd; 
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }
      th, td { 
        padding: 12px; 
        text-align: left; 
        border-bottom: 1px solid #eee;
        vertical-align: top;
        font-size: 0.9em;
      }
      th { 
        background-color: #003366;
        color: white;
        font-weight: bold;
      }
      tr:nth-child(even) {
        background-color: #f2f2f2;
      }
      .severity-critical { 
        color: red; 
        font-weight: bold; 
        padding: 4px 8px; 
        border-radius: 4px; 
        background-color: #ffe6e6;
        text-align: center;
      }
      .severity-serious { 
        color: orange; 
        font-weight: bold; 
        padding: 4px 8px; 
        border-radius: 4px; 
        background-color: #fff2e6;
        text-align: center; 
      }
      .severity-moderate {
        color: #e6c600;
        font-weight: bold;
        background-color: #fffbe6;
        padding: 4px 8px;
        border-radius: 4px;
        text-align: center;
      }
      .collapsible {
        cursor: pointer;
        background-color: #f1f1f1;
        padding: 10px;
        border: none;
        text-align: left;
        outline: none;
        font-size: 14px;
        margin-bottom: 5px;
        color: #006699;
      }
      .collapsible.active, .collapsible:hover {
        background-color: #ddd;
      }
      .content {
        padding: 0 12px;
        display: none;
        overflow: hidden;
        background-color: #f9f9f9;
      }
      td.fixed-column {
        max-width: 500px;
        max-height: 100px;
        overflow: auto;
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-all;
        font-size: 0.85em;
        background-color: #f9f9f9;
        text-align: center;
        vertical-align: top; /* Align the content to the top */
      }
      td.fixed-column button {
        margin-top: 5px;
      }
      td.centered {
        text-align: center; /* Center the "Fix" link */
        vertical-align: middle; /* Vertically center the content */
      }
      .node-summary {
        font-size: 0.85em;
        color: #555;
        margin-bottom: 1px;
        margin-top: 1px;
      }
      pre {
        margin: 2px 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-all;
      }
      code {
        word-wrap: break-word;
        white-space: pre-wrap;
        word-break: break-all;
      }
    </style>`;

  // Inline JavaScript for collapsible functionality
  const inlineJS = `
    <script>
      document.addEventListener('DOMContentLoaded', function () {
        const collapsibles = document.querySelectorAll('.collapsible');
        collapsibles.forEach(collapsible => {
          collapsible.addEventListener('click', function () {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            content.style.display = content.style.display === 'block' ? 'none' : 'block';
          });
        });
      });
    </script>`;

  let htmlContent = `
  <html>
  <head>
    <title>Nala Accessibility Test Report</title>
    ${inlineCSS}
  </head>
  <body>
    <h1>Nala Accessibility Test Report</h1>
    
    <div class="metadata-container">
      <p><i class="icon">🖥️</i><span>Test Run:</span> ${testRunType}</p>
      <p>${isGitHubAction ? `<i class="icon">👤</i><span>Triggered By:</span> ${triggeredBy}` : `<i class="icon">👤</i><span>Triggered By:</span> Nala QE`}</p>
      <p><i class="icon">⚠️</i><span>Total Violations:</span>${totalViolations}</p>
      <p><i class="icon">⏱️</i><span>Run Time:</span> ${time}</p>
      <p><i class="icon">ℹ️</i><span>Info:</span> <strong>Nala leverages the @axe-core/playwright</strong> library for accessibility testing.</p>
    </div>`;

  // Test details section
  report.forEach((result, resultIndex) => {
    htmlContent += `
    <div class="section-header">
      <h2>#${resultIndex + 1} Test Name: ${result.testName || 'N/A'}</h2>
      <p><strong>Test Page:</strong> <a href="${result.url}" target="_blank">${result.url}</a></p>
      <p><strong>Test Scope:</strong><code> ${result.testScope || 'N/A'}</code></p>
    </div>

    <div class="violation-section">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Violation</th>
            <th>Axe Rule ID</th>
            <th>Severity</th>
            <th>WCAG Tags</th>
            <th>Nodes Affected</th>
            <th>Possible Fix</th>
          </tr>
        </thead>
        <tbody>`;

    if (result.violations && result.violations.length > 0) {
      result.violations.forEach((violation, index) => {
        const description = violation.description || 'N/A';
        const ruleId = violation.id || 'N/A';
        const severity = violation.impact || 'N/A';
        const severityClass = `severity-${severity.toLowerCase()}`;
        const wcagTags = Array.isArray(violation.tags)
          ? violation.tags.join(', ')
          : 'N/A';

        const nodesAffected =
          violation.nodes && violation.nodes.length > 0
            ? violation.nodes
                .map(
                  (node, nodeIndex) => `
            <p class="node-summary">${nodeIndex + 1}. Affected Node:
              <pre><code>${escapeHTML(node.html || 'N/A')}</code></pre>
            </p>`
                )
                .join('')
            : 'No nodes affected';

        const possibleFix = violation.helpUrl
          ? `<a href="${violation.helpUrl}" target="_blank">Fix</a>`
          : 'N/A';

        htmlContent += `
          <tr class="${severityClass}">
            <td>${index + 1}</td>
            <td>${description}</td>
            <td>${ruleId}</td>
            <td class="${severityClass}">${severity}</td>
            <td>${wcagTags}</td>
            <td class="fixed-column">
              <button class="collapsible">Show Nodes</button>
              <div class="content">
                ${nodesAffected}
              </div>
            </td>
            <td class="centered">${possibleFix}</td>
          </tr>`;
      });
    }

    htmlContent += `
        </tbody>
      </table>
    </div>`;
  });

  htmlContent += `
    ${inlineJS}
  </body>
  </html>`;
  
  // Write the HTML report to file
  try {
    await fs.writeFile(reportPath, htmlContent);
    console.info(`Accessibility report saved at: ${reportPath}`);
  } catch (err) {
    console.error(`Failed to save accessibility report: ${err.message}`);
  }
}
