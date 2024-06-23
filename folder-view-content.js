(function(){

    const FILE_SUFFIX = "-viewed-file"
    const FILE_DIFF_PREFIX = "file-tree-item-"

    const FILE_OPTIONS_ABSTRACT = {
        headers: {accept:'text/html', "x-requested-with": "XMLHttpRequest"},
        method: 'POST',
        body: ''
    }
    var allFilesStatus={};

    let progressBar;
    let filesCount;
    let observer;
    let sidebarObserver;
    let isMainContentLoaded;
    let isSidebarLoaded;

    $( document ).ready(function() {
        console.log( "hello Peter !" );
        updateFilesCount();
        initSidebarMutation();
        initMutationObserver();
    });

    function appendCheckboxes(){
        let CHECKBOX_TEMPLATE = `<div class="custom-spinner ActionList-item-action hide"></div><input type="checkbox" class="ActionList-item-action  custom-view-checkbox" tabindex="0">`;

        $('li.ActionList-item[data-tree-entry-type="directory"] button.ActionList-content').prepend(CHECKBOX_TEMPLATE);
    }

    function initEvents(){
       let customCheckboxes = $('li.ActionList-item[data-tree-entry-type="directory"] input.custom-view-checkbox');

       customCheckboxes.on('click', (event)=>event.stopPropagation());
       customCheckboxes.on('change', onCheckboxChange);
       $(document).on('click', 'input.js-reviewed-checkbox', onFileDefaultCheckboxClick); //delegating as this is progressively rendered
    }

    function onCheckboxChange(event){
        let target = event.target;
        let state = target.checked;
        let currentFolder = target.closest('li.ActionList-item[data-tree-entry-type="directory"]');
        let childCheckboxes = $(currentFolder).find('li.ActionList-item[data-tree-entry-type="directory"] button.ActionList-content .custom-view-checkbox');
        let folderFiles = $(currentFolder).find('[data-tree-entry-type="file"] [data-filterable-item-text]');
        let fileNodesToClick = [];
        target.parentElement.ariaExpanded = !state;
       
        //toggleSpinner
        toggleSpinner(true);

        //Checking all Children
        childCheckboxes.each((index, element)=>{
            markFolder(element, state);
        });

        //Updating all files (nested)
        $(folderFiles).each((index, element)=>{
            let fileName = element.innerText;
            let fileViewCheckbox = document.getElementById(`${fileName}${FILE_SUFFIX}`);
            
            if(!fileViewCheckbox){
                console.info(fileViewCheckbox, 'box not found');
            }

            if(fileViewCheckbox?.checked !== state){
                //Updating default file checkbox state
                fileViewCheckbox.checked = state;

                //Toggling the file accordion
                toggleFileDetailsAccordion(fileViewCheckbox, fileName, state);
                
                //Constructing Promise to update state
                let form = fileViewCheckbox.closest('form');
                let tokenInput = form.querySelector('input[name="authenticity_token"]');
                let formObj = getFormObj(form, state);
                let apiUrl = form.action;
                let apiOptions = {...FILE_OPTIONS_ABSTRACT, body:formObj}
                let promise = fetch(apiUrl, apiOptions)
                                .then(resp=>responseToText(resp))
                                .then(data=>updateToken(data, tokenInput))
                                .catch(handleError);
                fileNodesToClick.push(promise);
            } 
        })
        
        //API calls - might need to chunk it to avoid rate limit if there are any
        if(fileNodesToClick.length){
            //Updating progress bar
            updateProgressBar(state, fileNodesToClick.length);

            Promise.all(fileNodesToClick).then(()=>{
                toggleSpinner();
            }, error=>console.error(error, 'files not updated'));
        }

        checkParents(currentFolder, state);
    }

    function toggleSpinner(showSpinner){
        if(showSpinner){
            $('.custom-spinner').removeClass('hide');
            $('.custom-view-checkbox').addClass('hide');
            $('.js-reviewed-checkbox').addClass('hide');
        }
        else{
            $('.custom-spinner').addClass('hide');
            $('.custom-view-checkbox').removeClass('hide');
            $('.js-reviewed-checkbox').removeClass('hide');
        }
    }

    function updateProgressBar(state, updatedFilesCount){
        if(!progressBar){
            console.info('no progress bar');
            return;
        };

        let progressRatioArr = progressBar.attributes.ratio.value.split(' / ')
        let viewedFilesCount = Number(progressRatioArr[0]);
        progressRatioArr[0] = state && viewedFilesCount+updatedFilesCount || viewedFilesCount-updatedFilesCount;
        progressBar.attributes.ratio.value = progressRatioArr.join(' / ');
    }

    function toggleFileDetailsAccordion(fileViewCheckbox, fileName, state){
        let fileDetailsContainer = fileViewCheckbox.closest(`[data-tagsearch-path="${fileName}"]`);
        if(state) fileDetailsContainer.classList.remove('open', 'Details--on');
        else fileDetailsContainer.classList.add('open', 'Details--on');
    }
    
    function getFormObj(form, state){
        
        let formObj = new FormData(form);
        
        if(state && formObj.has('_method')) formObj.delete('_method');
        else if(!state && !formObj.has('_method')) formObj.append('_method', 'delete');

        return formObj;
    }

    function checkParents(folder, state){
        let parentFolder = folder.parentElement.closest('li.ActionList-item[data-tree-entry-type="directory"]');

        //parent folder not there so return
        if(!parentFolder) return;

        let parentInput = getFolderInput(parentFolder);

        // parent folder is already unchecked, so we need not update it
        //?Note: parent folder checked and our state checked cannot happen
        if(parentInput.checked === state) return;

        //if checkbox checked
        if(state){
            let siblings = $(folder).siblings('li[data-tree-entry-type]');
    
            for(let i=0; i<siblings.length; i++){
                let sibling = siblings[i];
                let type = sibling.dataset.treeEntryType;
                if(type==='directory' && !isFolderChecked(sibling)) return;
                if(type==='file' && !isFileViewed(sibling)) return;
            }
        }

        //Updating parent folder state
        markFolder(parentInput, state);

       return checkParents(parentFolder, state);
    }

    function isFolderChecked(node){
        let input = $(node).find('input.custom-view-checkbox:first')[0];
        return input && input.checked;
    }

    function isFileViewed(node){
        let fileName=$(node).find('[data-filterable-item-text]')[0].innerText
        return allFilesStatus[fileName+FILE_SUFFIX];
    }

    function onFileDefaultCheckboxClick(event){
        event.preventDefault();
        toggleSpinner(true);
        let target = event.target;
        let state = target.checked;

        allFilesStatus[target.id] = state;
        let fileName = target.id.split(FILE_SUFFIX)[0];
        toggleFileDetailsAccordion(target, fileName, state);

        if(!event.isTrigger){
            let fileDiffId = target.closest('[data-details-container-group="file"]').id;
            let fileNode = document.getElementById(`${FILE_DIFF_PREFIX}${fileDiffId}`);
            updateFolder(fileNode, state);
        }
        
        setTimeout(()=>{
            target.checked = state;
            //Updating progress bar
            updateProgressBar(state, 1);
        }, 0);
        
        let form = target.closest('form');
        let formObj = getFormObj(form, state);
        let tokenInput = form.querySelector('input[name="authenticity_token"]');
        let apiUrl = form.action;
        let apiOptions = {...FILE_OPTIONS_ABSTRACT, body:formObj}
        
        fetch(apiUrl, apiOptions)
        .then(resp=>responseToText(resp))
        .then(data=>updateToken(data, tokenInput))
        .then(()=>toggleSpinner())
        .catch(handleError);
    }

    function responseToText(response){
        return response.text();
    }

    function updateToken(data, tokenInput){
        let regex = /<input(.*?)name=\"authenticity_token\"(.*)value=\"(?<token>.*?)\"(.*?)\/>/;
        let groups =  data.match(regex).groups;
        tokenInput.value = groups.token;
        return true;
    }

    function handleError(error){
        console.error(error, 'unable to update file');
    }

    function updateFolder(fileNode, state){
        let currentFolder = fileNode.closest('li.ActionList-item[data-tree-entry-type="directory"]');
        if(!currentFolder) return; //There can be files that can be present in root
        let currentFolderInput = getFolderInput(currentFolder);
        
        if(state===currentFolderInput.checked) return;

        //state -> un-checked & Folder -> checked
        if(!state){
            markFolder(currentFolderInput, false); //*This won't trigger the change event we written
            return checkParents(currentFolder, state);
        }
        
        //state -> checked & Folder -> unchecked
        let siblings = $(fileNode).siblings('li[data-tree-entry-type]');
        let canFolderChecked = canFolderReviewed(currentFolder, siblings);
        if(!canFolderChecked) return; //Folder is already un-checked so no need to update
        markFolder(currentFolderInput, true)
        return checkParents(currentFolder, state);

    }

    function canFolderReviewed(folder, siblings){
        if(!siblings)
            siblings = $(folder).find('.ActionList--subGroup:first').find('li[data-tree-entry-type]');

        for(let i=0; i<siblings.length; i++){
            let sibling = siblings[i];
            let type = sibling.dataset.treeEntryType;
            if(type==='directory' && !isFolderChecked(sibling)) return false;
            if(type==='file' && !isFileViewed(sibling)) return false;
        }

        return true;
    }

    function updateFilesCount(){
        progressBar=document.getElementsByTagName('progress-bar')[0];
        if(!progressBar){
            setTimeout(()=>{
                updateFilesCount();
            }, 2000);
        };
        progressArr = progressBar.attributes.ratio.value.split(' / ');

        filesCount = Number(progressArr[1]);
    }

    function initMutationObserver(){
        let nodeToObserve = document.getElementById('files');
        observer = new MutationObserver(mutationCallback);
        observer.observe(nodeToObserve, {childList:true, subtree:true});
        mutationCallback();
    }

    function initSidebarMutation(){
        let nodeToObserve = document.querySelector('.Layout-sidebar');
        sidebarObserver = new MutationObserver(sidebarMutationCallback);
        sidebarObserver.observe(nodeToObserve, {childList:true, subtree:true});
        sidebarMutationCallback();
    }

    function mutationCallback(mutations){
        console.log(mutations?.length, 'new mutations');
        let files =  document.querySelectorAll(`input[id*="${FILE_SUFFIX}"]`);
        if(files.length === filesCount){
            observer?.disconnect();
            isMainContentLoaded = true;

            if(isSidebarLoaded){
                runPreConfigs();
            }
        }
    }

    function sidebarMutationCallback(mutations){
        console.log(mutations?.length, 'new mutations sidebar');
        let files =  document.querySelectorAll(`li[id*=${FILE_DIFF_PREFIX}]`);
        if(files.length === filesCount){
            sidebarObserver?.disconnect();
            isSidebarLoaded = true;
            initExtension();
            if(isMainContentLoaded){
                runPreConfigs();
            }
        }
    }

    function initExtension(){
        appendCheckboxes();
        toggleSpinner(true);
        initEvents();
    }

    function runPreConfigs(){
        updateAllFilesStatus();
        presetFolderStates();
        prependSpinnersToContentFiles();
        toggleSpinner();
    }

    function prependSpinnersToContentFiles(){
        $('form label.js-reviewed-toggle').prepend(`<div class="custom-spinner ActionList-item-action hide"></div>`);
    }

    function updateAllFilesStatus(){
        let files =  document.querySelectorAll(`input[id*="${FILE_SUFFIX}"]`);
        files.forEach(file=>allFilesStatus[file.id]=file.checked);
    }

    function presetFolderStates(){
        let folderNodes = document.querySelectorAll('li[data-tree-entry-type="directory"]');
        for(let i=folderNodes.length-1; i>=0;i--){
            let folder = folderNodes[i];
            let folderInput = getFolderInput(folder);
            markFolder(folderInput, canFolderReviewed(folder));
        }
    }

    function getFolderInput(folder){
        return $(folder).find('input.custom-view-checkbox:first')[0] || {}; //Temp Fix
    }

    function markFolder(folderInput, state){
        folderInput.checked = state;
        folderInput.parentElement.ariaExpanded = !state;
    }

})();