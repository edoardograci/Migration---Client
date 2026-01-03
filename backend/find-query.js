const { Client } = require('@notionhq/client');
const notion = new Client({ auth: 'secret' });

function findPath(obj, key, path = 'notion') {
    if (!obj || typeof obj !== 'object') return;
    if (Object.keys(obj).includes(key)) {
        console.log('Found:', path + '.' + key);
    }
    for (const k of Object.keys(obj)) {
        if (k === 'parent') continue; // avoid cycles if any
        findPath(obj[k], key, path + '.' + k);
    }
}

findPath(notion, 'query');
