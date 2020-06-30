import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, SfdxError } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { gitDiffSum, createWhatToPrint, showDiffSum } from '../../git_diff_sum';
import { fsSaveJson } from '../../fs_save_json';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('affirm', 'changes');

export default class Changes extends SfdxCommand {

    public static description = messages.getMessage('commandDescription');

    public static examples = [
        `$ sfdx affirm:changes
            CHANGED: MyClass.cls,MySecondClass.cls
            INSERTION: MyTestClass.cls
            DESTRUCTIVE: MyOldClass.cls,MyOldTestClass.cls
        `,
        `$ sfdx affirm:changes --showdestructive
            DESTRUCTIVE: MyOldClass.cls
        `,
        `$ sfdx affirm:changes --showinsertion
            INSERTION: MyTestClass.cls
        `,
        `$ sfdx affirm:changes --showchanged
            CHANGED: MyClass.cls
        `
    ];

    // public static args = [{ branch: 'file', silent: 'boolean', outfilename: 'file' }];
    protected static flagsConfig = {
        // flag with a value (-n, --name=VALUE)
        branch: flags.string({ char: 'b', description: messages.getMessage('branchFlagDescription') }),
        inputdir: flags.string({ char: 'n', description: messages.getMessage('inputdirFlagDescription') }),
        showdestructive: flags.boolean({ char: 'd', description: messages.getMessage('showdestructiveFlagDescription') }),
        showinsertion: flags.boolean({ char: 'i', description: messages.getMessage('showinsertionFlagDescription') }),
        showchanged: flags.boolean({ char: 'c', description: messages.getMessage('showchangedFlagDescription') }),
        silent: flags.boolean({ char: 's', description: messages.getMessage('silentFlagDescription') }),
        outfilename: flags.string({ char: 'o', description: messages.getMessage('outfilenameFlagDescription') })
    };

    // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
    protected static requiresProject = false;

    public async run(): Promise<AnyJson> {
        // TODO: add error handling for directories without a git repo or remote.
        // if(no git repo configured) throw new SfdxError(messages.getMessage('errorNoGitRepo'));
        const branch = this.flags.branch || 'remotes/origin/master';
        // if(No Remote repo configured) throw new SfdxError(messages.getMessage('errorNoGitRemote'));
        // TODO: add support for getting sfdx-project.json as sfdx-project from the current directory
        // TODO: add support for multiple directories listed in sfdx-project.packageDirectories
        // TODO: add support for comma seperated list of input directories other than what's in sfdx-project.packageDirectories
        // TODO: change this to force-app
        const inputdir = this.flags.inputdir || 'force-app';
        const result = await gitDiffSum(branch, inputdir);
        const print = !this.flags.silent;
        if (print) {
            const whatToPrint = await createWhatToPrint(this.flags.showchanged, this.flags.showinsertion, this.flags.showdestructive);
            await showDiffSum(this.ux, result, whatToPrint);
        }
        
        const saveToFile = this.flags.outfilename;
        if (saveToFile) {
            await fsSaveJson(saveToFile, result);
        }
        return result;
    }
}