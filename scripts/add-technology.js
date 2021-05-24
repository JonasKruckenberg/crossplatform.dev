//@ts-check

const { promises: fs } = require('fs');
const { existsSync } = require('fs');
const path = require('path');
const { stringify } = require('json5');

const DOCS_ROOT = path.join(__dirname, '..', 'docs');
const TECHNOLOGY_TEMPLATE_PATH = path.join(
  __dirname,
  'templates',
  'technology'
);
const DATA_PATH = path.join(__dirname, '..', 'data');
const TECHNOLOGIES_PATH = path.join(DATA_PATH, 'technologies');
const SIDEBARS_PATH = path.join(__dirname, '..', 'sidebars.js');
// TODO: Create this from the schema so it's easier to maintain
const TECHNOLOGY = {
  $schema: '../schemas/technology.json',
  name: '',
  platforms: {
    Windows: '',
    macOS: '',
    Linux: '',
    Android: '',
    iOS: '',
  },
  languages: {
    'C++': '',
    'C#': '',
    Go: '',
    Java: '',
    'Node.js': '',
    Rust: '',
  },
  releases: [],
  url: 'https://',
  community: 'https://',
  documentation: 'https://',
};

/**
 * Listens for stdin and returns the first line of text received.
 * @returns {Promise<string>}
 */
const getInput = () => {
  return new Promise((resolve) => {
    process.stdin.addListener('data', function (data) {
      const input = data.toString().trim();
      if (input.length > 0) {
        process.stdin.removeAllListeners('data');
        resolve(input);
      }
    });
  });
};

/**
 *
 * @param {string} name
 */
const normalize = (name) => {
  return name.toLowerCase().replace(/(\s+)/g, '-');
};

/**
 * Naively creates all the necessary folders for the given `route`.
 * @param {string} route The route to create, has to be absolute and no filename
 */
const mkdirp = async (route) => {
  if (existsSync(route)) {
    return;
  }

  const parent = path.dirname(route);

  if (!existsSync(parent)) {
    await mkdirp(parent);
  }

  await fs.mkdir(route);
};

/**
 * Loads all the templates to create a new technology entry
 * @param {string} [filter]
 * @returns {Promise<Map<string,string>>}
 */
const loadTemplates = async (filter = '') => {
  const files = (await fs.readdir(TECHNOLOGY_TEMPLATE_PATH)).filter((file) =>
    file.endsWith(filter)
  );
  const templates = new Map();
  for (const file of files) {
    const content = await fs.readFile(
      path.join(TECHNOLOGY_TEMPLATE_PATH, file),
      'utf-8'
    );
    templates.set(file, content);
  }

  return templates;
};

/**
 * Given the `string` content, it interpolates all the `values`
 * on it.
 * @param {string} content
 * @param {{key: string;value: string;}[]} values
 * @returns
 */
const interpolate = (content, values) => {
  let interpolated = content;
  for (const { key, value } of values) {
    interpolated = interpolated.replace(
      new RegExp(`\\$\\{${key}\\}`, 'g'),
      value
    );
  }

  return interpolated;
};

/**
 *
 * @param {Map<string, string>} templates
 * @param {{key: string;value: string;}[]} information
 * @param {string} destination
 */
const writeTemplates = async (templates, information, destination) => {
  await mkdirp(destination);

  const files = [];

  for (const [filePath, content] of templates) {
    const finalPath = path.join(destination, filePath);
    const interpolatedContent = interpolate(content, information);

    await fs.writeFile(finalPath, interpolatedContent, 'utf-8');
    files.push(finalPath);
  }

  return files;
};

const start = async () => {
  console.log('Technology name?');
  const technology = await getInput();
  const normalizedTechnology = normalize(technology);

  const templates = await loadTemplates('.md');

  const information = [
    {
      key: 'technology',
      value: technology,
    },
    {
      key: 'normalizedTechnology',
      value: normalizedTechnology,
    },
  ];

  const createdFiles = await writeTemplates(
    templates,
    information,
    path.join(DOCS_ROOT, normalizedTechnology)
  );

  console.log(`Documentation files created:
${createdFiles.join('\n')}`);

  const json = { ...TECHNOLOGY, ...{ name: technology } };

  await fs.writeFile(
    path.join(TECHNOLOGIES_PATH, `${normalizedTechnology}.json`),
    JSON.stringify(json, null, 2),
    'utf-8'
  );

  const category = {
    type: 'category',
    label: technology,
    items: [{ type: 'autogenerated', dirName: normalizedTechnology }],
  };

  const sidebars = require(SIDEBARS_PATH);

  sidebars.websiteSidebar.push(category);

  console.log(`Updating sidebars.js`);
  await fs.writeFile(
    SIDEBARS_PATH,
    `module.exports = ${stringify(sidebars, null, 2)};\n`,
    'utf-8'
  );

  // Need to pause reading so the process exists correctly
  process.stdin.pause();
};

start();
