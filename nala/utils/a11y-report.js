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

  console.log('Nala A11Y ReportPath: ', reportPath);

  // Check if the report contains violations
  if (!report || report.length === 0) {
    console.error('No accessibility violations to report.');
    return;
  }

  const testRunType = isGitHubAction
    ? 'GitHub Env Run'
    : process.env.CIRCLECI
    ? 'CircleCI Env Run'
    : 'Local Run';

  const cssPath = isGitHubAction
    ? path.join('/home/runner/work/milo/milo/nala/utils/a11y.css')
    : path.join(__dirname, '../utils/a11y.css');

  const jsPath = isGitHubAction
    ? path.join('/home/runner/work/milo/milo/nala/utils/a11y.js')
    : path.join(__dirname, '../utils/a11y.js');

  console.log('CSSPath : ', cssPath);
  console.log('JSPath: ', jsPath);

  // Inline CSS for the report
  const inlineCSS = `
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
        margin: 20px; 
        background-color: #f9f9f9; 
        color: #333;
      }
      h1, h2, h3 { 
        color: #333; 
      }
      h1 {
        font-size: 2em;
        text-align: left;
        margin-bottom: 20px;
      }
      h2, h3 {
        font-size: 1.2em;
        margin-bottom: 5px;
        font-weight: 500;
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
        background-color: #f5f5f5; 
        font-weight: bold;
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
    <title>Nala Accessibility Report</title>
    <link rel="stylesheet" href="${inlineCSS}">  <!-- Link to external CSS -->
  </head>
  <body>
    <h1>Nala Accessibility Report</h1>
    <h2>Total Violations: ${report.length}</h2>
    <h3>Test Run: ${testRunType}</h3>`;

  report.forEach((result, resultIndex) => {
    htmlContent += `
      <div class="section-header">
        <h3>#${resultIndex + 1}.</h3>
        <h3>Test Name: ${result.testName || 'N/A'}</h3>
        <h3>Test Page: <a href="${result.url}" target="_blank">${
      result.url
    }</a></h3>
        <h3>Test Scope: ${result.testScope || 'N/A'}</h3>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 20%;">Violation</th>
            <th style="width: 15%;">Axe Rule ID</th>
            <th style="width: 10%;">Severity</th>
            <th style="width: 10%;">WCAG Tags</th>
            <th style="width: 30%;">Nodes Affected</th>
            <th style="width: 10%;">Possible Fix</th>
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
            <td>${possibleFix}</td>
          </tr>`;
      });
    }

    htmlContent += `
        </tbody>
      </table>`;
  });

  htmlContent += `
    <script src="${inlineJS}"></script>  <!-- Link to renamed external JS -->
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
