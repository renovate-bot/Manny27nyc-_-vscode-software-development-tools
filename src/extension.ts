import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as dataProvider from './DataProvider';
import TelemetryReporter from 'vscode-extension-telemetry';
const config = require('../config.json');
const catalogImages = new dataProvider.TreeDataProvider;
const tempDirectory = require('temp-dir');
const kill = require('tree-kill');

// Array to store all the child process' pid generated.
//Use this to terminate all these processes on deactivate if vscode window is closed by user. Otherwise child process will keep running till it's exit.
let processArray: any[] = [];  						
function pushProcess(value: any) {
	processArray.push(value);
}
function deleteProcess(index:any){
	processArray.splice(index,1);
}
// Export this as object to dataprovider. This way modifying process[] data is possible from other files.
export { processArray, pushProcess, deleteProcess }; 
// Reporter initiated inside activate function to dispose it properly.
let reporter:any;
export {reporter};

// Executed when your registered Activation Event happens.
export function activate(context: vscode.ExtensionContext) { 
  	// Registers the source of catalog's tree data
 	context.subscriptions.push(
		 vscode.window.registerTreeDataProvider('IntelSoftwareDevelopmentTools', catalogImages)
	);

	// Register a command that issues docker pull command and provide docker troubleshooting help
	context.subscriptions.push(
		vscode.commands.registerCommand('IntelSoftwareDevelopmentTools.createAndSendToTerminal', (item:dataProvider.TreeItemChild) =>
		catalogImages.createAndSendToTerminal(item))
	);

	// Register a command that opens a Docker image full description MarkDown Preview
	context.subscriptions.push(
		vscode.commands.registerCommand('IntelSoftwareDevelopmentTools.fullDescription', (item:dataProvider.TreeItemChild,namespace:any,name:any) => 
		catalogImages.fullDescription(item,namespace,name))
	);

	// Register a command that renders the tree again.
	// It is called when a docker pull completes and we have to change that item's icon.
	context.subscriptions.push(
		vscode.commands.registerCommand('IntelSoftwareDevelopmentTools.refresh', () => 
		catalogImages.refresh())
	);

	// Register a command that issues a docker pull command for already downloaded images.
	context.subscriptions.push(
		vscode.commands.registerCommand('IntelSoftwareDevelopmentTools.updateImage', (item:dataProvider.TreeItemChild) => 
		catalogImages.createAndSendToTerminal(item))
	);
	
	// Execute only if VS Code's telemetry is enabled.
	if(vscode.env.isTelemetryEnabled) {
		// All events will be prefixed with this extensionID.
		const extensionId = config.extensionId;
		const extension = vscode.extensions.getExtension(extensionId)!;
		const extensionVersion = extension.packageJSON.version;
		// The application insights connection_string, not a password, just a identifier.
		// TODO : Connection_string will be obfuscated on github. Add config.json to .gitignore
		let key = config.connection_string;
		// Register the telemetry reporter.
		reporter = new TelemetryReporter(extensionId, extensionVersion, key);
		context.subscriptions.push(reporter);
	}
}

// Deactivate function activated when user closes the VSCode window or disables/uninstalls the extension.
export async function deactivate(){
	const baseDir = path.join(tempDirectory,"IntelSoftwareDevelopmentTools-VScode-Extension"); 
	// Removes the temporary files created by the extension.
	fs.rmdirSync(baseDir, { recursive: true });
	// Closes all the active child processes run by the extension.
	if(os.platform() === 'win32'){
		for(let eachProcess of processArray){
			require('child_process').exec('taskkill /pid ' + eachProcess.pid + ' /T /F'); 
		}
	}
	else{
		for(let eachProcess of processArray){
			kill(eachProcess.pid);
		}
	}
	// Dispose telemetry reporter
	reporter.dispose();
}
