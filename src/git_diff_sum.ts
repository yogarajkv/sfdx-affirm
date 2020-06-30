import simpleGit, { SimpleGit, StatusResult } from 'simple-git'; // Docs: https://github.com/steveukx/git-js#readme
const GIT_SSH_COMMAND = "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no";

const filesToIgnore = ['**/jsconfig.json','**/.eslintrc.json'];

function ignoreFile(file: string) {
    if(filesToIgnore.includes(file)) return true;
    const fileNameOnly = '**'+file.substring(file.lastIndexOf('/'));
    if(filesToIgnore.includes(fileNameOnly)) return true;
    return false;
}

interface DiffObj {
    changed: Array<String>;
    insertion: Array<String>;
    destructive: Array<String>;
};

interface WhatToPrint {
    changed: Boolean,
    insertion: Boolean,
    destructive: Boolean,
    showAll: Boolean
};

export async function gitDiffSum(branch: string, inputdir: string) {
    const git: SimpleGit = simpleGit();
    await git.env('GIT_SSH_COMMAND', GIT_SSH_COMMAND).status();
    const diffSum = await git.env({ ...process.env, GIT_SSH_COMMAND }).diffSummary([branch]);
    // console.log(diffSum);
    const result: DiffObj = {
        changed: [],
        insertion: [],
        destructive: []
    };

    diffSum.files.forEach(file => {
        if (!file.file.startsWith(inputdir) || ignoreFile(file.file)) return;
        if (file.changes === file.insertions && file.deletions === 0 && !file.file.includes('=>')) {
            result.insertion = [...result.insertion, file.file];
        } 
        // TODO: this bit of logic for finding destructive changes doesn't work correctly. 
        // else if (file.changes === file.deletions && !file.file.includes('=>')) {
        //     result.destructive = [...result.destructive, file.file];
        // } 
        else if (file.file.includes('=>')) {
            const path = file.file.substring(0, file.file.indexOf('{'));
            const files = file.file.substring(file.file.indexOf('{'));
            const oldFile = path + files.substring(0, files.indexOf('=')).replace('{', '').trim();
            const newFile = path + files.substring(files.indexOf('>') + 1).replace('}', '').trim();
            result.destructive = [...result.destructive, oldFile];
            result.insertion = [...result.insertion, newFile];
        } else {
            result.changed = [...result.changed, file.file];
        }
    });
    return result;
}


export async function showDiffSum(ux: UX, diff: DiffObj, whatToPrint: WhatToPrint) {
    Object.keys(diff).forEach(key => {
        if (diff[key].length === 0 && (whatToPrint[key] || whatToPrint.showAll)) {
            ux.log(key.toUpperCase() + ': None Found')
        } else if (whatToPrint[key] || whatToPrint.showAll) {
            ux.log(key.toUpperCase() + ': ' + diff[key]);
        }
    });
}

export async function createWhatToPrint(onlyChanged: Boolean, onlyInsertion: Boolean, onlyDestructive: Boolean) {
    const whatToPrint: WhatToPrint = {
        changed: onlyChanged,
        insertion: onlyInsertion,
        destructive: onlyDestructive,
        showAll: !onlyChanged && !onlyInsertion && !onlyDestructive
    };
    return whatToPrint;
}