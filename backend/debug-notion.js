const { Client } = require('@notionhq/client');
const notion = new Client({ auth: 'secret' });
console.log('Databases keys:', Object.keys(notion.databases));
// Try to inspect prototype if keys are hidden
console.log('Databases proto keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(notion.databases)));
