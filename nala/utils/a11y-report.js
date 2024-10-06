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
  const baseUrl = process.env.PR_BRANCH_LIVE_URL || (process.env.LOCAL_TEST_LIVE_URL || 'https://main--milo--adobecom.hlx.live')
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
    0,
  );

  const severityCount = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };

  report.forEach((result) => {
    result.violations?.forEach((violation) => {
      if (violation.impact) {
        severityCount[violation.impact] += 1;
      }
    });
  });

  // Inline CSS for the report
  const inlineCSS = `
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
        margin: 20px; 
        background-color: #f9f9f9; 
        color: #333;
      }
      .banner {
        background: linear-gradient(135deg, #a45db3, #f0d4e2);
        padding: 30px 0;
        text-align: center;
        color: white;
        border-radius: 10px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        margin-bottom: 30px;
      }
      .banner h1 {
        font-size: 2.5em;
        margin: 0;
      }        
      h1 {
        font-size: 2.5em;
        text-align: center;
        margin-bottom: 20px;
        color: #003366;
      }
      .metadata-container, .summary-container {
        background-color: #e3f2fd;
        background: linear-gradient(135deg, #e6f2ff, #cce0ff);
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        margin-bottom: 30px;
        text-align: left;
        font-size: 1.1em;
        color: #333;
      }
      .metadata-container span, .summary-container span {
        display: inline-block;
        width: 150px; 
        font-weight: bold;
        color: #003366;
      }
      .metadata-container p, .summary-container p {
        margin: 0;
        padding: 5px 0;
      }
      .metadata-container p:hover, .summary-container p:hover {
        background-color: #f1f8ff;
        border-radius: 5px;
      }
      .summary-container {
        font-size: 1.1em;
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
        font-size: 1.2em;
      }
      .section-header p {
        font-size: 1em;
        color: #333;
        margin: 5px 0;
      }
      .violation-section {
        background-color: #f0f0f0;
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
      .severity-minor {
        color: green;
        font-weight: bold;
        padding: 4px 8px;
        border-radius: 4px;
        background-color: #e6ffe6;
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
      .collapsible::after {
        content: ' ▼'; 
        font-size: 0.8em;
      }
      .collapsible.active::after {
        content: ' ▲';
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
        vertical-align: top; 
      }
      td.fixed-column button {
        margin-top: 5px;
      }
      td.centered {
        text-align: center; 
        vertical-align: middle;
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
      .filters {
        text-align: center;
        margin-bottom: 20px;
      }
      .filters button {
        padding: 10px 20px;
        margin: 5px;
        border: none;
        background-color: #003366;
        color: #fff;
        border-radius: 5px;
        cursor: pointer;
        font-size: 1em;
      }
      .filters button:hover {
        background-color: #00509e;
        transform: scale(1.05);
      }
      .filters button:focus {
        outline: 2px solid #ffcc00; 
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

        // Filtering function
        function filterBySeverity(severity) {
          const rows = document.querySelectorAll('.violation-row');
          rows.forEach(row => {
            const severityCell = row.querySelector('.severity-column');
            const testContainer = row.closest('.test-container');
            if (severityCell) {
              if (!severity || severityCell.textContent.toLowerCase() === severity.toLowerCase()) {
                row.style.display = ''; // Show the row
                if (testContainer) testContainer.style.display = ''; // Show the test container
              } else {
                row.style.display = 'none'; // Hide the row
                // Hide the test container if all its rows are hidden
                if (testContainer) {
                  const visibleRows = Array.from(testContainer.querySelectorAll('.violation-row')).filter(r => r.style.display !== 'none');
                  testContainer.style.display = visibleRows.length > 0 ? '' : 'none';
                }
              }
            }
          });
        }

        document.querySelectorAll('.filter-button').forEach(button => {
          button.addEventListener('click', () => {
            const severity = button.getAttribute('data-severity');
            filterBySeverity(severity);
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
    <div class="banner">
      <h1> Nala Accessiblity Test Report </h1>
        <p style="font-size: 0.8em; line-height: 1.5;">
          <i class="icon">ℹ️</i><strong>Nala leverages the @axe-core/playwright</strong> library for accessibility testing, enabling developers to quickly identify and resolve issues.
          <br>
            Axe-core evaluates compliance with <a href="https://www.w3.org/WAI/WCAG21/quickref/" target="_blank">WCAG 2.0, 2.1, and 2.2</a> standards across levels A, AA, and AAA.
          <br>
            This ensures web pages meet accessibility requirements across regions like the United States and European Union, 
          <br>
            fostering inclusivity for individuals with disabilities.
        </p>
    </div>    
    <div class="metadata-container">
      <p><i class="icon">📋</i><span> Test Summary:</span></p>
      <p><i class="icon">🖥️</i><span>Test Run:</span> ${testRunType}</p>
      <p>${isGitHubAction ? `<i class="icon">👤</i><span>Triggered By:</span> ${triggeredBy}` : '<i class="icon">👤</i><span>Triggered By:</span> Nala QE'}</p>
      <p><i class="icon">🌐</i><span>Test Env (URL):</span> ${baseUrl}</p>
      <p><i class="icon">⏱️</i><span>Run Time:</span> ${time}</p>
      <p><i class="icon">⚠️</i><span>Total Violations:</span>${totalViolations} (Critical: ${severityCount.critical}, Serious: ${severityCount.serious}, Moderate: ${severityCount.moderate}, Minor: ${severityCount.minor})</p>
    </div>
    <div class="filters">
      <button class="filter-button" data-severity="">All</button>
      <button class="filter-button" data-severity="critical">Critical (${severityCount.critical})</button>
      <button class="filter-button" data-severity="serious">Serious (${severityCount.serious})</button>
      <button class="filter-button" data-severity="moderate">Moderate (${severityCount.moderate})</button>
      <button class="filter-button" data-severity="minor">Minor (${severityCount.minor})</button>
    </div>`;

  // Test details section
  report.forEach((result, resultIndex) => {
    htmlContent += `
    <div class="section-header test-container">
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

        const nodesAffected = violation.nodes && violation.nodes.length > 0
          ? violation.nodes
            .map(
              (node, nodeIndex) => `
            <p class="node-summary">${nodeIndex + 1}. Affected Node:
              <pre><code>${escapeHTML(node.html || 'N/A')}</code></pre>
            </p>`,
            )
            .join('')
          : 'No nodes affected';

        const possibleFix = violation.helpUrl
          ? `<a href="${violation.helpUrl}" target="_blank">Fix</a>`
          : 'N/A';

        htmlContent += `
          <tr class="violation-row ${severityClass}">
            <td>${index + 1}</td>
            <td>${description}</td>
            <td>${ruleId}</td>
            <td class="severity-column ${severityClass}">${severity}</td>
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
