import simpleGit, { SimpleGit, StatusResult, DiffSummary } from 'simple-git'; // Docs: https://github.com/steveukx/git-js#readme
import { SfdxError } from '@salesforce/core';
import { DiffObj, DestructiveXMLMain, DestructiveXMLType, DestructiveXMLTypeEntry, WhatToPrint } from './affirm_interfaces';
const GIT_SSH_COMMAND = "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no";
const git: SimpleGit = simpleGit();

const filesToIgnore = ['**/jsconfig.json', '**/.eslintrc.json'];

function ignoreFile(file: string) {
  if (filesToIgnore.includes(file)) return true;
  const fileNameOnly = '**' + file.substring(file.lastIndexOf('/'));
  if (filesToIgnore.includes(fileNameOnly)) return true;
  return false;
}

export async function checkForRepoAndRemote() {
  const isRepo = git.checkIsRepo();
  if (!isRepo) throw SfdxError.create('affirm', 'helper_files', 'errorNoGitRepo');
}

export async function getCurrentBranchName(ux?: UX) {
  await checkForRepoAndRemote();
  const repoStatus: StatusResult = await git.status();
  const currentBranch = repoStatus.current;
  if (ux) ux.log('current branch: ' + currentBranch);
  return currentBranch;
}

export async function getRemoteInfo(ux?: UX) {
  await checkForRepoAndRemote();
  const remotes = await git.getRemotes(true);
  if (!remotes) throw SfdxError.create('affirm', 'helper_files', 'errorNoGitRemote');
  const currentRemote = remotes[0].name + ' => ' + remotes[0].refs.push;
  if (ux) ux.log('Current Remote: ' + currentRemote);
  return currentRemote;
}

export async function gitDiffSum(branch: string, inputdir: string) {
  // get the diff sum of $branch...$currentBranch minus deleted files
  await git.env('GIT_SSH_COMMAND', GIT_SSH_COMMAND).status();
  const diffSum: DiffSummary = await git.env({ ...process.env, GIT_SSH_COMMAND }).diffSummary([branch, '--diff-filter=d']);
  // construct the object that will store the diff sum results
  const result: DiffObj = {
    changed: new Set(),
    insertion: new Set(),
    destructive: new Set()
  };
  // sort the changed files into their specific location
  diffSum.files.forEach(file => {
    if (!file.file.startsWith(inputdir) || ignoreFile(file.file)) return;
    if (file.changes === file.insertions && file.deletions === 0 && !file.file.includes('=>')) {
      result.insertion.add(file.file);
    } else if (file.file.includes('=>')) {
      const path = file.file.substring(0, file.file.indexOf('{'));
      const files = file.file.substring(file.file.indexOf('{'));
      const oldFile = path + files.substring(0, files.indexOf('=')).replace('{', '').trim();
      const newFile = path + files.substring(files.indexOf('>') + 1).replace('}', '').trim();
      result.destructive.add(oldFile);
      result.insertion.add(newFile);
    } else {
      result.changed.add(file.file);
    }
  });
  // get the diff sum of $branch...$currentBranch - only deleted files
  const diffSumDeletions: DiffSummary = await git.env({ ...process.env, GIT_SSH_COMMAND }).diffSummary([branch, '--diff-filter=D']);
  if (diffSumDeletions.files && diffSumDeletions.files.length > 0) {
    diffSumDeletions.files.forEach(file => {
      if (!file.file.startsWith(inputdir) || ignoreFile(file.file)) return;
      result.destructive.add(file.file);
    });
  }
  return result;
}


export async function showDiffSum(ux: UX, diff: DiffObj, whatToPrint: WhatToPrint) {
  Object.keys(diff).forEach(key => {
    if (diff[key].length === 0 && (whatToPrint[key] || whatToPrint.showAll)) {
      ux.log(key.toUpperCase() + ': None Found')
    } else if (whatToPrint[key] || whatToPrint.showAll) {
      ux.log(key.toUpperCase() + ': ' + [...diff[key]].join(' '));
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
