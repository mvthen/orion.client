/*******************************************************************************
 * @license
 * Copyright (c) 2014 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global parent window document define orion setTimeout*/

define(["orion/bootstrap", "orion/xhr", 'orion/webui/littlelib', 'orion/Deferred', 'orion/cfui/cFClient', 'orion/PageUtil', 'orion/selection',
	'orion/URITemplate', 'orion/PageLinks', 'orion/preferences', 'cfui/cfUtil', 'orion/objects', 'orion/widgets/input/ComboTextInput', 'orion/i18nUtil',
	'orion/webui/Wizard', 'cfui/plugins/wizards/common/deploymentLogic', 'cfui/plugins/wizards/common/commonPaneBuilder', 'cfui/plugins/wizards/common/corePageBuilder', 
	'cfui/plugins/wizards/common/servicesPageBuilder', 'cfui/plugins/wizards/common/additionalParamPageBuilder'], 
		function(mBootstrap, xhr, lib, Deferred, CFClient, PageUtil, mSelection, URITemplate, PageLinks, Preferences, mCfUtil, objects, ComboTextInput, i18nUtil, Wizard,
				mDeploymentLogic, mCommonPaneBuilder, mCorePageBuilder, mServicesPageBuilder, mAdditionalParamPageBuilder) {

	var cloudManageUrl;
	
	/* plugin-host communication */
	var postMsg = mCfUtil.defaultPostMsg;
	var postError = mCfUtil.defaultPostError;
	var closeFrame = mCfUtil.defaultCloseFrame;
	
	/* status messages */
	function showMessage(message){
		document.getElementById('messageLabel').appendChild(document.createTextNode(message));
		document.getElementById('messageContainer').classList.add("showing"); //$NON-NLS-0$
	}
	
	function hideMessage(){
		lib.empty(document.getElementById('messageLabel'));
		document.getElementById('messageContainer').classList.remove("showing"); //$NON-NLS-0$
	}
	
	mBootstrap.startup().then(function(core) {
		
		/* set up initial message */
		document.getElementById('title').appendChild(document.createTextNode("Configure Application Deployment")); //$NON-NLS-1$//$NON-NLS-0$
		
		/* allow the frame to be closed */
		document.getElementById('closeDialog').addEventListener('click', closeFrame); //$NON-NLS-1$ //$NON-NLS-0$
		 
		/* allow frame to be dragged by title bar */
		var that = this;
		var iframe = window.frameElement;
	    setTimeout(function(){
	    	
			var titleBar = document.getElementById('titleBar');
			titleBar.addEventListener('mousedown', function(e) {
				that._dragging = true;
				if (titleBar.setCapture) {
					titleBar.setCapture();
				}
				
				that.start = {
					screenX: e.screenX,
					screenY: e.screenY
				};
			});
			
			titleBar.addEventListener('mousemove', function(e) {
				if (that._dragging) {
					var dx = e.screenX - that.start.screenX;
					var dy = e.screenY - that.start.screenY;
					
					that.start.screenX = e.screenX;
					that.start.screenY = e.screenY;
					
					var x = parseInt(iframe.style.left) + dx;
					var y = parseInt(iframe.style.top) + dy;
					
					iframe.style.left = x+"px";
					iframe.style.top = y+"px";
				}
			});
			
			titleBar.addEventListener('mouseup', function(e) {
				that._dragging = false;
				if (titleBar.releaseCapture) {
					titleBar.releaseCapture();
				}
			});
	    });
			
		var pageParams = PageUtil.matchResourceParameters();
		var resourceString = decodeURIComponent(pageParams.resource);
		var resource = JSON.parse(resourceString);
			
		var serviceRegistry = core.serviceRegistry;
		var cfService = new CFClient.CFService(serviceRegistry);
			
		/* compute relative content location */
		var relativeFilePath = new URL(resource.ContentLocation).href;
		var orionHomeUrl = new URL(PageLinks.getOrionHome());
			
		if(relativeFilePath.indexOf(orionHomeUrl.origin) === 0)
			relativeFilePath = relativeFilePath.substring(orionHomeUrl.origin.length);
			
		if(relativeFilePath.indexOf(orionHomeUrl.pathname) === 0)
			relativeFilePath = relativeFilePath.substring(orionHomeUrl.pathname.length);
			
		var preferences = new Preferences.PreferencesService(serviceRegistry);
		
		/* deployment plan */
		var plan = resource.Plan;
		var manifestApplication = plan.Manifest.applications[0];
		
		mCfUtil.getTargets(preferences).then(function(clouds){
			
			/* welcome page */
			var defaultSelection;
			var page0 = new Wizard.WizardPage({
		    	template: "<div class=\"deployMessage\" id=\"planMessage\"></div>",
		    	
		    	render: function(){
		    		this.wizard.validate();
		    		var target = clouds[0];
		    		
		    		showMessage("Deployment configuration...");
		    		cfService.getOrgs(target).then(function(resp){
		    			hideMessage();
		    			
		    			var org = resp.Orgs[0];
		    			var space = org.Spaces[0];
		    			
		    			target.Org = org.Name;
		    			target.Space = space.Name;
		    			
		    			defaultSelection = new mSelection.Selection(serviceRegistry, "orion.Spaces.selection"); //$NON-NLS-0$
		    			defaultSelection.setSelections(target);
		    			
		    			var messageTemplate = "<b>${0}</b> is going to be deployed as a <b>node.js</b> application to <b>${1}</b> @ <b>${2}</b>."+
		    				"Click \"Deploy\" to proceed.";
		    			var message = i18nUtil.formatMessage(messageTemplate, manifestApplication.name, space.Name, org.Name);
		    			
		    			var messageDiv = document.getElementById("planMessage");
			    		messageDiv.innerHTML = message;
			    		
		    		}, postError);
		    	},
		    	
		    	validate: function(setValid){
		    		setValid(true);
		    		return;
		    	},
		    	
		    	getResults: function(){
		    		return {};
		    	}
		    });
			
			/* init common pane builder */
			var commonPaneBuilder = new mCommonPaneBuilder.CommonPaneBuilder({
		    	AppPath : resource.AppPath /* relative application path */
		    });
		    
			/* init core page builder */
		    var corePageBuilder = new mCorePageBuilder.CorePageBuilder({
		    	Clouds : clouds,
		    	
		    	ManifestApplication : manifestApplication,
		    	serviceRegistry : serviceRegistry,
		    	CFService : cfService,
		    	
		    	showMessage : showMessage,
		    	hideMessage : hideMessage,
		    	postError : postError
		    });
		    
		    /* init services page builder */
		    var servicesPageBuilder = new mServicesPageBuilder.ServicesPageBuilder({
		    	ManifestServices : manifestApplication.services,
		    	
		    	CFService : cfService,
		    	getTargetSelection : function(){
		    		return corePageBuilder.getSelection();
		    	},
		    	
		    	showMessage : showMessage,
		    	hideMessage : hideMessage,
		    	postError : postError
		    });
		    
		    /* init additional parameters page builder */
		    var additionalParamPageBuilder = new mAdditionalParamPageBuilder.AdditionalParamPageBuilder({
		    	ManifestApplication : manifestApplication
		    });
		    
		    /* build pages */
		    var commonPane = commonPaneBuilder.build();
		    var page1 = corePageBuilder.build();
		    var page2 = servicesPageBuilder.build();
		    var page3 = additionalParamPageBuilder.build();
		    
			var wizard = new Wizard.Wizard({
				parent: "wizard",
				pages: [page0, page1, page2, page3],
				commonPane: commonPane,
				onCancel: closeFrame,
				buttonNames: { ok: "Deploy" },
				size: { width: "370px", height: "180px" },
				onSubmit: mDeploymentLogic.buildDeploymentTrigger({
					
					showMessage : showMessage,
					closeFrame : closeFrame,
					disableUI : function(){
						if(corePageBuilder._orgsDropdown)
							corePageBuilder._orgsDropdown.disabled = true;
						
						if(corePageBuilder._spacesDropdown)
							corePageBuilder._spacesDropdown.disabled = true;
					},
					
					postMsg : postMsg,
					postError : postError,
					
					CFService : cfService,
					getTargetSelection : function(){
						
						var selection = corePageBuilder.getSelection();
						if(typeof selection === "undefined" && defaultSelection)
							return defaultSelection;
						
			    		return selection;
			    	},
			    	
			    	saveManifest : function(){
			    		var checkbox = commonPaneBuilder._saveManifestCheckbox;
			    		return checkbox ? checkbox.checked : false;
			    	},
			    	
			    	Manifest : plan.Manifest,
			    	ContentLocation : resource.ContentLocation,
			    	AppPath : resource.AppPath
				})
			});
			
		}, postError);
	});
});