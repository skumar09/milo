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
  const reportName = `nala-a11y-report-${time.toISOString().replace(/[:.]/g, '-')}.html`;


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


  const currentWorkingDir = process.cwd();
  const relativeCSSPath = path.join(currentWorkingDir, '/nala/utils/a11y.css');
  const relativeJSPath = path.join(currentWorkingDir, '/nala/utils/a11y.js');

  console.log('current working directory : ', currentWorkingDir);
  console.log('relativeCSSPath : ', relativeCSSPath);
  console.log('relativeJSPath: ', relativeJSPath);


  let htmlContent = `
  <html>
  <head>
    <title>Nala Accessibility Report</title>
    <link rel="stylesheet" href="${relativeCSSPath}">  <!-- Link to external CSS -->
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
        <h3>Test Page: <a href="${result.url}" target="_blank">${result.url}</a></h3>
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
        const wcagTags = Array.isArray(violation.tags) ? violation.tags.join(', ') : 'N/A';

        const nodesAffected = violation.nodes && violation.nodes.length > 0
          ? violation.nodes.map((node, nodeIndex) => `
            <p class="node-summary">${nodeIndex + 1}. Affected Node:
              <pre><code>${escapeHTML(node.html || 'N/A')}</code></pre>
            </p>`).join('')
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
    <script src="${relativeJSPath}"></script>  <!-- Link to renamed external JS -->
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
