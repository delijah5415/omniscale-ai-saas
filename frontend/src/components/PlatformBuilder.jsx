import React, { useState } from 'react';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase.js';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const initialPreferences = {
  framework: 'React + Vite',
  language: 'JavaScript',
  styling: 'Tailwind CSS',
  database: 'Supabase',
  authentication: 'Supabase Auth',
  additionalFeatures: ''
};

const tabs = ['Preview', 'Files', 'Architecture', 'Terminal'];

function createSandboxedPreview(html) {
  const policy = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\">";
  const source = typeof html === 'string' ? html : '';

  if (/<head(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<head(?:\s[^>]*)?>/i, match => match + policy);
  }

  if (/<html(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<html(?:\s[^>]*)?>/i, match =>
      match + '<head>' + policy + '</head>'
    );
  }

  return '<!doctype html><html><head>' + policy +
    '</head><body>' + source + '</body></html>';
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-300 mb-2">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-sky-500"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function TerminalLine({ children, tone = 'normal' }) {
  const colors = {
    normal: 'text-slate-300',
    success: 'text-emerald-400',
    error: 'text-red-400',
    info: 'text-sky-400',
    muted: 'text-slate-500'
  };

  return (
    <div className={'font-mono text-xs sm:text-sm leading-6 break-words ' + colors[tone]}>
      {children}
    </div>
  );
}

export default function PlatformBuilder({ accessToken, subscriptionStatus }) {
  const [platformPrompt, setPlatformPrompt] = useState('');
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('Preview');
  const [selectedFile, setSelectedFile] = useState('');
  const [terminalLines, setTerminalLines] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const updatePreference = (key, value) => {
    setPreferences(current => ({ ...current, [key]: value }));
  };

  const addTerminalLine = (message, tone = 'normal') => {
    setTerminalLines(current => [
      ...current,
      { message, tone, id: current.length + 1 }
    ]);
  };

  const handleGenerate = async event => {
    event.preventDefault();
    setError('');

    if (!accessToken || subscriptionStatus !== 'active') {
      setError('An authenticated account with verified active access is required.');
      return;
    }

    if (!platformPrompt.trim()) {
      setError('Describe the platform you want to generate first.');
      return;
    }

    if (platformPrompt.trim().length > 12000) {
      setError('Your description must be 12,000 characters or fewer.');
      return;
    }

    setLoading(true);
    setProject(null);
    setSelectedFile('');
    setActiveTab('Terminal');
    setTerminalLines([
      { id: 1, message: 'OmniScale AI Platform Builder', tone: 'info' },
      { id: 2, message: 'Validating project request...', tone: 'normal' },
      { id: 3, message: 'Preparing authenticated generation request...', tone: 'normal' },
      { id: 4, message: 'Request submitted. Waiting for AI generation response...', tone: 'info' }
    ]);

    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data?.session?.access_token;

      if (sessionResult.error || !token) {
        throw new Error('Your session could not be verified. Please sign in again.');
      }

      const response = await fetch(API_URL + '/builder/build-platform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          platformPrompt: platformPrompt.trim(),
          preferences
        })
      });

      const responseText = await response.text();
      let data;

      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        const contentType = response.headers.get('content-type') || '';
        const message = contentType.includes('application/json')
          ? 'The API returned invalid JSON.'
          : 'The API returned a non-JSON response. Check that the backend is running and the API URL is correct.';
        throw new Error(message);
      }

      if (!response.ok || !data.success || !data.project) {
        throw new Error(data.error || 'Platform generation failed.');
      }

      const generatedProject = data.project;

      if (!Array.isArray(generatedProject.files) || generatedProject.files.length === 0) {
        throw new Error('The generation response did not contain a valid project file manifest.');
      }

      const firstValidFile = generatedProject.files.find(file =>
        file &&
        typeof file.path === 'string' &&
        typeof file.content === 'string'
      );

      if (!firstValidFile) {
        throw new Error('The generation response contains no valid project files.');
      }

      setProject(generatedProject);
      setSelectedFile(firstValidFile.path);
      setActiveTab('Preview');

      const receivedLines = Array.isArray(data.stages) ? data.stages : [];

      setTerminalLines([
        { id: 1, message: 'OmniScale AI Platform Builder', tone: 'info' },
        { id: 2, message: 'Generation response received.', tone: 'success' },
        ...receivedLines.map((stage, index) => ({
          id: index + 3,
          message: '[' + String(stage.status || 'completed').toUpperCase() + '] ' +
            String(stage.name || 'Generation stage') +
            (stage.detail ? ' — ' + stage.detail : ''),
          tone: stage.status === 'failed' ? 'error' : 'success'
        })),
        {
          id: receivedLines.length + 3,
          message: 'Project manifest ready: ' + generatedProject.files.length + ' files.',
          tone: 'success'
        },
        {
          id: receivedLines.length + 4,
          message: 'Preview and ZIP export are available. Compilation and deployment have not been run.',
          tone: 'muted'
        }
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Platform generation failed.';
      setError(message);

      const failedStages = Array.isArray(err?.stages) ? err.stages : [];

      setTerminalLines(current => [
        ...current,
        ...failedStages.map((stage, index) => ({
          id: current.length + index + 1,
          message: '[' + String(stage.status || 'unknown').toUpperCase() + '] ' +
            String(stage.name || 'Generation stage') +
            (stage.detail ? ' — ' + String(stage.detail) : ''),
          tone: stage.status === 'failed' ? 'error' : 'muted'
        })),
        {
          id: current.length + failedStages.length + 1,
          message: 'ERROR: ' + message,
          tone: 'error'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!project || downloading) return;

    setDownloading(true);
    setError('');

    try {
      const zip = new JSZip();
      const reservedRootFiles = new Set([
        'preview.html',
        'readme.md',
        'omniscale-project-manifest.json'
      ]);
      const seenPaths = new Set();

      for (const file of project.files) {
        if (!file || typeof file.path !== 'string' ||
            typeof file.content !== 'string') {
          throw new Error('The project contains an invalid file entry.');
        }

        const normalizedPath = file.path.trim();
        const segments = normalizedPath.split('/');
        const normalizedKey = normalizedPath.toLowerCase();

        const forbiddenNames = new Set([
          '.env', '.git', 'node_modules', '.vercel', '.ssh'
        ]);

        const isProtectedEnvFile = (name) => {
          const lowerName = name.toLowerCase();
          return lowerName === '.env' ||
            (lowerName.startsWith('.env.') && lowerName !== '.env.example');
        };

        const reservedWindowsName =
          /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

        if (!normalizedPath ||
            normalizedPath !== file.path ||
            normalizedPath.length > 180 ||
            normalizedPath.startsWith('/') ||
            normalizedPath.includes('\\') ||
            segments.some(part =>
              !part ||
              part === '.' ||
              part === '..' ||
              part !== part.trim() ||
              /[<>:"|?*\x00-\x1f]/.test(part) ||
              /[. ]$/.test(part) ||
              forbiddenNames.has(part.toLowerCase()) ||
              isProtectedEnvFile(part) ||
              reservedWindowsName.test(part)
            )) {
          throw new Error('The project contains an unsafe file path.');
        }

        if (segments.length === 1 && reservedRootFiles.has(normalizedKey)) {
          throw new Error('A generated file conflicts with a reserved ZIP export file: ' + normalizedPath);
        }

        if (seenPaths.has(normalizedKey)) {
          throw new Error('The project contains duplicate file paths.');
        }

        if ([...seenPaths].some((existingPath) =>
          existingPath.startsWith(normalizedKey + '/') ||
          normalizedKey.startsWith(existingPath + '/')
        )) {
          throw new Error('The project contains conflicting file and directory paths.');
        }

        seenPaths.add(normalizedKey);
      }

      for (const file of project.files) {
        zip.file(file.path, file.content);
      }

      if (project.previewHtml) {
        zip.file('preview.html', project.previewHtml);
      }

      const readme = [
        '# ' + (project.projectName || 'OmniScale Generated Project'),
        '',
        project.summary || '',
        '',
        '## Selected preferences',
        ...Object.entries(project.preferences || preferences).map(entry => '- ' + entry[0] + ': ' + entry[1]),
        '',
        '## Suggested build commands',
        ...(Array.isArray(project.buildCommands) ? project.buildCommands.map(command => '- ' + command) : []),
        '',
        'These commands are suggestions only. They have not been executed by OmniScale.',
        'Review the generated files and configure your environment before running the project.'
      ].join('\n');

      zip.file('README.md', readme);
      zip.file('omniscale-project-manifest.json', JSON.stringify({
        projectName: project.projectName,
        summary: project.summary,
        architecture: project.architecture,
        preferences: project.preferences || preferences,
        buildCommands: project.buildCommands || [],
        generatedAt: new Date().toISOString()
      }, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      const safeName = String(project.projectName || 'omniscale-project')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'omniscale-project';

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = safeName + '.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      addTerminalLine('ZIP export created successfully.', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ZIP export failed.');
    } finally {
      setDownloading(false);
    }
  };

  const currentFile = project?.files?.find(file => file.path === selectedFile);

  return (
    <section className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              <span className="text-xs uppercase tracking-widest text-sky-400 font-semibold">AI development studio</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Platform Builder</h2>
            <p className="text-slate-400 mt-2">Describe your application, configure its stack, generate project files and inspect the preview.</p>
          </div>
          <div className="text-xs rounded-full border border-slate-700 px-3 py-2 text-slate-300">
            {subscriptionStatus === 'active' ? 'Access verified' : 'Access required'}
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2" htmlFor="platform-prompt">
              What do you want to build?
            </label>
            <textarea
              id="platform-prompt"
              value={platformPrompt}
              onChange={event => setPlatformPrompt(event.target.value)}
              rows={6}
              maxLength={12000}
              placeholder="Example: Build a multi-vendor marketplace with customer accounts, vendor dashboards, product listings, shopping cart, payments, order tracking and an admin control panel."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 resize-y"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Be specific about users, workflows, pages and business rules.</span>
              <span>{platformPrompt.length}/12,000</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-white">Technology preferences</h3>
              <span className="text-xs text-slate-500">Customizable project stack</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SelectField label="Framework" value={preferences.framework} onChange={value => updatePreference('framework', value)} options={['React + Vite', 'Next.js', 'Static HTML']} />
              <SelectField label="Language" value={preferences.language} onChange={value => updatePreference('language', value)} options={['JavaScript', 'TypeScript']} />
              <SelectField label="Styling" value={preferences.styling} onChange={value => updatePreference('styling', value)} options={['Tailwind CSS', 'CSS Modules', 'Plain CSS']} />
              <SelectField label="Database" value={preferences.database} onChange={value => updatePreference('database', value)} options={['Supabase', 'PostgreSQL', 'None']} />
              <SelectField label="Authentication" value={preferences.authentication} onChange={value => updatePreference('authentication', value)} options={['Supabase Auth', 'None']} />
            </div>
            <label className="block mt-4">
              <span className="block text-sm font-medium text-slate-300 mb-2">Additional features and requirements</span>
              <textarea
                value={preferences.additionalFeatures}
                onChange={event => updatePreference('additionalFeatures', event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Example: role-based permissions, email notifications, analytics dashboard, responsive mobile layout..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </label>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading || subscriptionStatus !== 'active'}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating project...' : 'Generate application'}
            </button>
            <span className="text-xs text-slate-500">
              AI generation can take time. Build and deployment are separate steps.
            </span>
          </div>
        </form>
      </div>

      {loading && (
        <div className="bg-slate-900 border border-sky-900 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"></div>
            <div>
              <p className="font-semibold text-white">AI is preparing your application</p>
              <p className="text-sm text-slate-400">Your request has been submitted. Waiting for the generation response and its recorded stages.</p>
            </div>
          </div>
        </div>
      )}

      {(project || terminalLines.length > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-sky-400 mb-1">Project workspace</p>
              <h3 className="text-xl font-bold text-white">{project?.projectName || 'Generation session'}</h3>
              {project?.summary && <p className="text-sm text-slate-400 mt-1">{project.summary}</p>}
            </div>
            {project && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {downloading ? 'Preparing ZIP...' : 'Download project ZIP'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 p-4 border-b border-slate-800">
            {tabs.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={'px-4 py-2 rounded-lg text-sm font-medium ' +
                  (activeTab === tab ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-4 md:p-6">
            {activeTab === 'Preview' && (
              project ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
                    <span>Isolated application preview</span>
                    <span>Generated HTML runs in a sandboxed frame</span>
                  </div>
                  <div className="bg-white rounded-xl overflow-hidden border border-slate-700">
                    <iframe
                      title="Generated application preview"
                      srcDoc={createSandboxedPreview(project.previewHtml || '<main><h1>Preview unavailable</h1></main>')}
                      sandbox="allow-scripts"
                      referrerPolicy="no-referrer"
                      className="w-full min-h-[560px] bg-white"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">The application preview will appear here after generation completes.</p>
              )
            )}

            {activeTab === 'Files' && (
              project ? (
                <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,2fr)] gap-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">Project files ({project.files.length})</p>
                    <div className="space-y-1">
                      {project.files.map(file => (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => setSelectedFile(file.path)}
                          className={'w-full text-left text-xs px-3 py-2 rounded-lg break-all ' +
                            (selectedFile === file.path ? 'bg-sky-900 text-sky-200' : 'text-slate-300 hover:bg-slate-800')}
                        >
                          {file.path}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-800 text-xs text-slate-400 break-all">
                      {currentFile?.path || 'Select a file'}
                    </div>
                    <pre className="p-4 overflow-auto max-h-[560px] text-xs leading-6 text-slate-300 whitespace-pre-wrap break-words">
                      {currentFile?.content || 'Select a generated file to inspect its contents.'}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Generated project files will appear here.</p>
              )
            )}

            {activeTab === 'Architecture' && (
              project ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2">Selected technology stack</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(project.preferences || preferences).map(entry => (
                        <span key={entry[0]} className="text-xs rounded-full bg-slate-800 border border-slate-700 px-3 py-2 text-slate-300">
                          {entry[0]}: {entry[1]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Architecture specification</h4>
                    <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs leading-6 text-slate-300 whitespace-pre-wrap overflow-auto">
                      {typeof project.architecture === 'string'
                        ? project.architecture
                        : JSON.stringify(project.architecture || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">The architecture specification will appear after generation.</p>
              )
            )}

            {activeTab === 'Terminal' && (
              <div className="bg-black border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                  <div className="flex gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">omniscale-build-log</span>
                </div>
                <div className="p-4 min-h-48 max-h-[440px] overflow-auto space-y-1">
                  {terminalLines.map(line => (
                    <TerminalLine key={line.id} tone={line.tone}>{line.message}</TerminalLine>
                  ))}
                  {loading && <TerminalLine tone="info">Waiting for AI response...</TerminalLine>}
                  {!terminalLines.length && <TerminalLine tone="muted">No build activity yet.</TerminalLine>}
                </div>
              </div>
            )}

            {project && Array.isArray(project.buildCommands) && project.buildCommands.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-900/70 bg-amber-950/20 p-4">
                <h4 className="text-sm font-semibold text-amber-300 mb-2">Suggested local build commands</h4>
                <p className="text-xs text-slate-400 mb-3">These are recommendations only. OmniScale has not executed them.</p>
                <div className="space-y-2">
                  {project.buildCommands.map((command, index) => (
                    <pre key={index} className="text-xs font-mono text-slate-300 bg-black rounded-lg p-3 whitespace-pre-wrap break-all">{command}</pre>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
