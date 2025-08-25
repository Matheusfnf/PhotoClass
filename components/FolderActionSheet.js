// Função utilitária para criar ActionSheet de seleção de pastas
const createFolderActionSheet = (showActionSheetWithOptions, folders, onSelectFolder, onCancel) => {
  if (!folders || folders.length === 0) {
  
    return;
  }

  // Preparar opções do ActionSheet
  const folderNames = folders.map(folder => folder.name);
  const options = [...folderNames, 'Cancelar'];
  const cancelButtonIndex = options.length - 1;



  showActionSheetWithOptions(
    {
      options,
      cancelButtonIndex,
      title: 'Selecionar Pasta',
      message: 'Escolha uma pasta para salvar a imagem',
    },
    (selectedIndex) => {

      
      if (selectedIndex === cancelButtonIndex || selectedIndex === undefined) {

        if (onCancel) onCancel();
        return;
      }

      const selectedFolder = folders[selectedIndex];

      
      if (selectedFolder && onSelectFolder) {

        onSelectFolder(selectedFolder.name);
      } else {

      }
    }
  );
};

export default createFolderActionSheet;