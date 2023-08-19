function updateAllFilesStat(){
        //? document.querySelectorAll('ul.ActionList--tree[data-tree-entry-type="root"] li[data-tree-entry-type="file"]')
        $('ul.ActionList--tree[data-tree-entry-type="root"]').find('[data-tree-entry-type="file"] [data-filterable-item-text]').each((index, element)=>{
            console.log(element, element.innerText, document.getElementById(`${element.innerText}-viewed-file`), 'file input data');
            // allFilesStatus[element.innerText] = document.getElementById(`${element.innerText}-viewed-file`).checked;
            //? document.querySelectorAll('input[id*="-viewed-file"]').length
        });

        console.log(allFilesStatus, 'allfilesStatus');
}

function onCheckboxClick(event){
    event.stopPropagation();
    
    let target = event.target;
    let isChecked = target.checked;
    let currentFolder = target.closest('li.ActionList-item[data-tree-entry-type="directory"]');
    
    $(target).parent().attr('aria-expanded', !isChecked);

    let childCheckboxes = $(currentFolder).find('li.ActionList-item[data-tree-entry-type="directory"] button.ActionList-content .custom-view-checkbox');
    
    childCheckboxes.each((index, element)=>{
        element.checked=isChecked;
        $(element).parent().attr('aria-expanded', !isChecked);
    })

    $(currentFolder).find('[data-tree-entry-type="file"] [data-filterable-item-text]').each((index, element)=>{
        let fileViewCheckbox = document.getElementById(`${element.innerText}-viewed-file`);
        if(fileViewCheckbox.checked !== isChecked) fileViewCheckbox.click();
    })
}