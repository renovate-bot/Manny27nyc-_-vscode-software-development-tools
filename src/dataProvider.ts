import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as fetchData from './FetchJson';
import { processArray, pushProcess, deleteProcess } from './extension';
import { reporter } from './extension';
const tempDirectory = require('temp-dir');
const kill = require('tree-kill');
const config = require('../config.json');
const fetchJson = fetchData.fetchJson;

// Implements inbuilt TreeDataProvider
export class TreeDataProvider implements vscode.TreeDataProvider<TreeItemChild> { 
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItemChild | undefined > = new vscode.EventEmitter<TreeItemChild | undefined >();
    readonly onDidChangeTreeData?: vscode.Event<TreeItemChild|undefined>=this._onDidChangeTreeData.event;
    constructor() {}
    // Array of parent items
    static imageTree: TreeItemChild[] = [];
    
    // Renders the tree again. Undefined calls the root of tree to repopulate.
    // It is called when a docker pull completes and we have to change the item's icon.
    public refresh(): void { 
        this._onDidChangeTreeData.fire(undefined);
      }

    // To return the UI representation (TreeItem).
    // of the element that gets displayed in the view.
    getTreeItem(eachItem: TreeItemChild): vscode.TreeItem|Thenable<vscode.TreeItem> { 
      return eachItem;
    }
    
    // Provides all the items for tree.
    public async getChildren(eachItem:TreeItemChild): Promise<TreeItemChild[]|undefined> {
        TreeDataProvider.imageTree = [];
        // Gets a string of names of already downloaded images.
        let repositoriesList = await this.checkForDownloadedImages(`${eachItem === undefined 
                                                                                ? undefined 
                                                                                // If Item is parent, send it's namespace as the parameter.
                                                                                : eachItem.contextValue === 'parent'  
                                                                                                        ? String(eachItem.namespace) 
                                                                                                        : undefined
        }`);
        // Returns all the child items in a namespace.
        let getChild = function(namespace:string): Promise<TreeItemChild[] | undefined>{ 
            return new Promise(async function(resolve){
                let dockerHubAPICall = `${config.dockerHubAPICall}/${namespace}/?page_size=100`;
                let fetchedJson:any;
                let childItems : TreeItemChild[] = []; 
                do {
                        // Fetches JSON from DockerHubAPI containing list of images in this namespace.
                        fetchedJson = await fetchJson(dockerHubAPICall); 
                        for (let object in fetchedJson.results) {
                                childItems.push(new TreeItemChild(
                                    fetchedJson.results[object].name,
                                    fetchedJson.results[object].description,
                                    {
                                        command: "IntelSoftwareDevelopmentTools.fullDescription",
                                        title: "Full Description",
                                        // Undefined signifies that Tree item is not being passed as argument. 
                                        arguments:  [undefined, fetchedJson.results[object].namespace, fetchedJson.results[object].name] 
                                    },
                                    // Checks item name against already downloaded images.
                                    `${repositoriesList.includes(fetchedJson.results[object].name) === true 
                                                                                                    ? 'downloadedChildItem' 
                                                                                                    : 'child'
                                    }`,
                                    undefined,
                                    fetchedJson.results[object].user
                                ));
                        }
                    } 
                // Go on fetching until all pages are read.
                while (fetchedJson.next !== null && (dockerHubAPICall = fetchedJson.next)); 
                return resolve(childItems);
            });
        };

        // Returns all the child items in intel namespace which contain 'oneapi' in their name.
        let getFilteredChild = function(namespace:string): Promise<TreeItemChild[] | undefined>{ 
            return new Promise(async function(resolve){
                let dockerHubAPICall = `${config.dockerHubAPICall}/${namespace}/?page_size=100`;
                let fetchedJson:any;
                let childItems : TreeItemChild[] = []; 
                do {
                        // Fetches JSON from DockerHubAPI containing list of images in this namespace.
                        fetchedJson = await fetchJson(dockerHubAPICall); 
                        for (let object in fetchedJson.results) {
                            if( fetchedJson.results[object].name.search(/oneapi/gi) !== -1){
                                childItems.push(new TreeItemChild(
                                    fetchedJson.results[object].name,
                                    fetchedJson.results[object].description,
                                    {
                                        command: "IntelSoftwareDevelopmentTools.fullDescription",
                                        title: "Full Description",
                                        // Undefined signifies that Tree item is not being passed as argument. 
                                        arguments:  [undefined, fetchedJson.results[object].namespace, fetchedJson.results[object].name] 
                                    },
                                    // Checks item name against already downloaded images.
                                    `${repositoriesList.includes(fetchedJson.results[object].name) === true 
                                                                                                    ? 'downloadedChildItem' 
                                                                                                    : 'child'
                                    }`,
                                    undefined,
                                    fetchedJson.results[object].user
                                ));
                            }
                        }
                    } 
                // Go on fetching until all pages are read.
                while (fetchedJson.next !== null && (dockerHubAPICall = fetchedJson.next)); 
                return resolve(childItems);
            });
        };

        // If tree is not yet defined, generate parent items.
        if(eachItem === undefined) { 
            let dockerHubAPICall:string;
            let fetchedJson:any;
            let displayNameSpace = ["OpenVINO™ toolkit", "Intel® oneAPI", "Open Visual Cloud"];
            // Add any new namespace to the catalog by just adding the namespace to this array. 
            let namespace = ["openvino", "intel", "openvisualcloud"];
            let convertForAPI:string;
            let i=0;
            for(let eachNameSpace of namespace){
                if(eachNameSpace == 'intel') {
                    dockerHubAPICall = `${config.dockerHubAPICall}/${eachNameSpace}/?page_size=100`;
                    fetchedJson = await fetchJson(dockerHubAPICall);
                    let oneAPIImageCount=0
                    for (let object in fetchedJson.results) {
                        if( fetchedJson.results[object].name.search(/oneapi/gi) !== -1){
                            oneAPIImageCount++;
                        }
                    }
                    TreeDataProvider.imageTree.push(new TreeItemChild(
                        `${displayNameSpace[i]} (${oneAPIImageCount} Images)`,
                        `${eachNameSpace}`,
                        undefined,
                        "parent",
                        undefined,
                        `${eachNameSpace}`
                    ));
                }
                else {
                    dockerHubAPICall = `${config.dockerHubAPICall}/${eachNameSpace}/`;
                    fetchedJson = await fetchJson(dockerHubAPICall);
                    TreeDataProvider.imageTree.push(new TreeItemChild(
                        `${displayNameSpace[i]} (${fetchedJson.count} Images)`,
                        `${eachNameSpace}`,
                        undefined,
                        "parent",
                        undefined,
                        `${eachNameSpace}`
                    ));
                }
                i++;
            }
        }
        // If tree is not yet defined, return parent items, else return child items for a parent item's namespace.
        return eachItem === undefined 
                            ? TreeDataProvider.imageTree 
                            : eachItem.contextValue === 'parent'
                                                        ? eachItem.namespace !== 'intel'
                                                                                ? await getChild(String(eachItem.namespace))
                                                                                : await getFilteredChild(String(eachItem.namespace))
                                                        : undefined;                        
    }
  
    // Runs a child process to fetch names of docker images already present on system.
    public async checkForDownloadedImages(namespace:string | undefined){ 
        let repositoriesList = '';
        if(namespace === undefined){
            return repositoriesList;
        }
        let child = require('child_process').exec(`${config.dockerImageList}`,{stdio: 'inherit'}); 
        child.stdout.on('data', function(data: { toString: () => any; }):any{
            // Store names of downloaded docker images.
            repositoriesList += data.toString();
            return data;

        });
        await new Promise(resolve => child.on('close', resolve));
        return repositoriesList;
    }

    // Renders the full description of an image.
    public async fullDescription(item?:TreeItemChild, namespace?:any, name?:any){ 
        if(item !== undefined){
            namespace = item.namespace;
            name = item.label;
        }
        const dockerHubAPICall = `${config.dockerHubAPICall}/${namespace}/${name}`;
        let fetchedJson:any;
        fetchedJson = await fetchJson(dockerHubAPICall);
        if(fetchedJson === undefined) {
            return undefined;
        }
        const fullDescription = fetchedJson.full_description;
        const baseDir = path.join(tempDirectory,"IntelSoftwareDevelopmentTools-VScode-Extension"); 
        if(!fs.existsSync(baseDir))
        {
            fs.mkdirSync(baseDir);
        }
        const imageSpecificDir = path.join(baseDir,name);
        if(!fs.existsSync(imageSpecificDir))
        {
            fs.mkdirSync(imageSpecificDir);
        }
        // Store full description text files in a temp directory.
        fs.writeFile(path.join(imageSpecificDir, `${name}.md`), fullDescription, function (err) { 
            if (err)
            {
                vscode.window.showErrorMessage(`${name} full description pull failed`);
                return;
            }
        });
        // Generates MarkDown preview of the full description.
        vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(path.resolve(imageSpecificDir, `${name}.md`))); 
    }

    // Create docker pull command and send to terminal. If docker related errors, then outputs them to user.
    public async createAndSendToTerminal(item:TreeItemChild){ 
        let namespace = item.namespace;
        let name = item.label;
        const dockerHubAPICall = `${config.dockerHubAPICall}/${namespace}/${name}/tags`;
        let fetchedJson:any;
        fetchedJson = await fetchJson(dockerHubAPICall);
        if(fetchedJson === undefined) {
            return undefined;
        }
        const tag = fetchedJson.results[0].name;
        // Send telemetry event
        if(vscode.env.isTelemetryEnabled){
            reporter.sendTelemetryEvent (
                // Event Name 
                'Image pull Event',
                // String property 
                {'dockerImage' : `${namespace}/${name}:${tag}`}, 
                // Numeric Property
                {'totalDockerPulls' : 1}
            );
        }
        const pullCommand = `docker pull ${namespace}/${name}:${tag}`;
        // Create an output channel
        let intelOutputChannel = vscode.window.createOutputChannel(`Channel #${name}`);
        let childProcess = require('child_process').exec(pullCommand,{stdio: 'inherit'}); 
        // Keeping track of child process in a global variable.
        pushProcess(childProcess); 
        // Create a status bar.
        let statusBarItem1 = vscode.window.createStatusBarItem("Pull Status", vscode.StatusBarAlignment.Left, 1);
        statusBarItem1.name = "Intel extension docker Pull Status";
        statusBarItem1.text = `$(sync~spin) Docker Pull active`;
        statusBarItem1.backgroundColor = new vscode.ThemeColor(`statusBarItem.warningBackground`);
        statusBarItem1.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        statusBarItem1.show();
        intelOutputChannel.show();
        let isErrorOccurred = false;

        // Changes the status bar red to display error.
        function setErrorStatusBar() { 
            statusBarItem1.backgroundColor = new vscode.ThemeColor(`statusBarItem.errorBackground`);
            statusBarItem1.text = '$(warning) Docker Pull Error';
            setInterval(function(){statusBarItem1.hide();},10000);
        }
        function cleanUpProcessArray(){
            let index = processArray.findIndex(array_elements_handle => array_elements_handle.pid === childProcess.pid);
            // Delete this child process from array of stored child processes.
            deleteProcess(index); 
        }
        // Event hook to provide a callback to execute when data is available. 
        childProcess.stdout.on('data', function(data: { toString: () => any; }) { 
            const childDataObj = {
                childData : data.toString()
            };
            // Checks on regular intervals when download is complete.
            const downloadCheckInterval = setTimeout(checkIfImageDownloaded,100,childDataObj); 
            function checkIfImageDownloaded(childDataObj: { childData: string; }){
                // Write to output channel.
                intelOutputChannel.appendLine(childDataObj.childData); 
                // If Image downloaded successfully.
                if(childDataObj.childData.search(/Status: Downloaded/gi) !== -1){ 
                    vscode.window.showInformationMessage(`Docker image pulled successfully : ${namespace}/${name}:${tag}`);
                    statusBarItem1.hide();
                    clearTimeout(downloadCheckInterval);
                    // Refresh the tree to change the icon for downloaded item.
                    vscode.commands.executeCommand('IntelSoftwareDevelopmentTools.refresh'); 
                    cleanUpProcessArray();
                }
                if(childDataObj.childData.search(/Status: Image is up to date/gi) !== -1){
                    statusBarItem1.hide();
                    vscode.window.showInformationMessage(`Docker Image is up to date : ${namespace}/${name}:${tag}`);
                    clearTimeout(downloadCheckInterval);
                    cleanUpProcessArray();
                }
            }
        });
        // When error occurs, provide troubleshooting.
        childProcess.stderr.on('data', async function(data: { toString: () => any; }) { 
            intelOutputChannel.clear();
            intelOutputChannel.dispose();
            setErrorStatusBar();
            cleanUpProcessArray();
            vscode.commands.executeCommand('workbench.action.output.toggleOutput');
            // Flag true when error occured. 
            isErrorOccurred = true; 
            let clipboardText = data.toString();
            if(clipboardText.search(/'docker' is not recognized/gi) !== -1 ||
               clipboardText.search(/docker: not found/gi) !== -1 ||
               clipboardText.search(/'docker' not found/gi) !== -1){
                const answer = await vscode.window.showErrorMessage(clipboardText,"Help");
                // If user clicks Help button.
                if(answer === "Help"){ 
                    if(os.platform() === 'win32'){
                        // Redirect to open help link in browser.
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.dockerIsNotRecognized_win32}`)); 
                    }
                    else {
                        // Shift focus to Output channel.
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.dockerIsNotRecognized_other}`));
                    }
                }
            }
            else if(clipboardText.search(/Client.Timeout exceeded/gi) !== -1){
                const answer = await vscode.window.showErrorMessage(clipboardText,"Help");
                if(answer === "Help"){
                    if(os.platform() === 'win32'){
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.clientTimeoutExceeded_win32}`));
                    }
                    else {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.clientTimeoutExceeded_other}`));
                    }
                }
            }
            else if(clipboardText.search(/docker daemon is not running/gi) !== -1 ||
             clipboardText.search(/Cannot connect to the Docker daemon/gi) !== -1) {
                const answer = await vscode.window.showErrorMessage(clipboardText,"Help");
                if(answer === "Help"){
                    if(os.platform() === 'win32'){
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.dockerDaemonNotRunning_win32}`));
                    }
                    else {
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.dockerDaemonNotRunning_other}`));
                    }
                }
            }
            else if(clipboardText.search(/reached your pull rate limit/gi) !== -1){
                const answer = await vscode.window.showErrorMessage(clipboardText,"Help");
                if(answer === "Help"){
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.pullRateLimit}`));
                }
            }
            else if(clipboardText.search(/permission denied/gi) !== -1){
                const answer = await vscode.window.showErrorMessage(clipboardText,"Help");
                if(answer === "Help"){
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`${config.permissionDenied}`));
                }
            }
            else {
                vscode.window.showErrorMessage(clipboardText);
            }
        }); 

        // Dialog box that provides option to stop docker pull.
        const getOptions = await vscode.window.showInformationMessage(`Pulling Docker Image : ${namespace}/${name}:${tag}`,
            "Show Progress",
            "Stop"
         ); 
        if(getOptions === "Stop"){
            if(childProcess.exitCode === null){
                await getUserInput();
            }
        }
        else{
           intelOutputChannel.show();
        }

        // Generates a drop down menu to confirm stop pulling image.
        async function getUserInput(){ 
            let quickPickItems: Array<vscode.QuickPickItem> = [
                {
                    label: "Yes",
                    description: "Stop Docker Pull"
                },
                {
                    label: "No",
                    description: "Continue Docker Pull"
                }
            ];
            const quickPickResponse = await vscode.window.showQuickPick(quickPickItems,{
                title:'Do you really want to stop Docker Pull ?',placeHolder:'Yes or No'
            });
            if(quickPickResponse){ 
                if (quickPickResponse.label === "Yes") {
                    stopDockerPull();
                    cleanUpProcessArray();
                    isErrorOccurred = true;
                }
                else{
                    intelOutputChannel.show();
                }
            }
        }

        // Kills all child processes recursively which were started by 'childProcess'.
        function stopDockerPull(){ 
            if(os.platform() === 'win32'){
                const childToStop = require('child_process').exec('taskkill /pid ' + childProcess.pid + ' /T /F',{stdio: 'inherit'}); 
                childToStop.stdout.on('data', function(data: { toString: () => any; }) {
                    intelOutputChannel.show();
                    intelOutputChannel.appendLine(data.toString());
                });
                childToStop.stderr.on('data', async function(data: { toString: () => any; }) {
                    intelOutputChannel.show();
                    intelOutputChannel.appendLine(data.toString());
                });
                childToStop.on('exit', function () {
                    childToStop.kill();
                });
            }
            else{
                kill(childProcess.pid, 'SIGTERM', function (err: string) {
                    // Get an error if you did not supply a valid childProcess.pid
                    if (err) { 
                        intelOutputChannel.appendLine(`\n${err}\n`);
                    }
                });
            }
            vscode.window.showWarningMessage(`Process aborted : Pulling docker image not completed successfully :  ${name} `);
            intelOutputChannel.appendLine(`Process aborted : Pulling docker image not completed successfully: ${name} `);
            intelOutputChannel.show();
            isErrorOccurred = true;
        }
        
        // If childProcess completes it's execution successfully.
        childProcess.on('exit', function () {  
            childProcess.kill();
            intelOutputChannel.show();
            isErrorOccurred === true
                            ?setErrorStatusBar()
                            :statusBarItem1.hide();
        });
    }
}

//Skeleton for each TreeItem Object extended from vscode's default tree item
export class TreeItemChild extends vscode.TreeItem {
    children: TreeItemChild[] | undefined;
    constructor(
        // Name
        public readonly label:string,
        // Description 
        description?: string, 
        // Full description command on child item click
        public readonly command?: vscode.Command, 
        // context value = { parent, child, downloadedChildItem } 
        public readonly contextValue?:string,
        // Child item array 
        children?: TreeItemChild[], 
        // Docker namespace for parent items
        public readonly namespace?:string, 
    ) 
    {
        super(label,contextValue === 'child' 
                                // Don't provide expand feature for child item.
                                ? vscode.TreeItemCollapsibleState.None 
                                : contextValue === 'downloadedChildItem'
                                                // Don't provide expand feature for child item.
                                                ? vscode.TreeItemCollapsibleState.None 
                                                // Do provide expand feature for parent item.
                                                :vscode.TreeItemCollapsibleState.Collapsed 
            );
        // HoverOver tooltip
        this.tooltip = `${description}`; 
        this.command = command;
        this.children = children;
        // Inline icon for tree child items.
        if(contextValue === "child"){
            this.iconPath = {
                light: path.join(__filename, '..', '..', 'resources', 'light', 'repo.svg'),
                dark: path.join(__filename, '..', '..', 'resources', 'dark', 'repo.svg')
            };
        }
        else if(contextValue === 'downloadedChildItem'){
            this.iconPath = {
                light: path.join(__filename, '..', '..', 'resources', 'light', 'pass.svg'),
                dark: path.join(__filename, '..', '..', 'resources', 'dark', 'pass.svg')
            };
        }
    }
}

