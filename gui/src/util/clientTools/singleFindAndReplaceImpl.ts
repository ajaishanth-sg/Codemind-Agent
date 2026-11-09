import { validateSingleEdit } from "core/edit/searchAndReplace/findAndReplaceUtils";
import { executeFindAndReplace } from "core/edit/searchAndReplace/performReplace";
import { validateSearchAndReplaceFilepath } from "core/edit/searchAndReplace/validateArgs";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";

export const singleFindAndReplaceImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const filepath = args.filepath ?? args.path ?? args.file ?? args.filename;
  const old_string =
    args.old_string ?? args.oldString ?? args.oldText ?? args.search;
  const new_string =
    args.new_string ?? args.newString ?? args.newText ?? args.replace;
  const replace_all = args.replace_all ?? args.replaceAll;

  const { oldString, newString, replaceAll } = validateSingleEdit(
    old_string,
    new_string,
    replace_all,
  );
  const fileUri = await validateSearchAndReplaceFilepath(
    filepath,
    extras.ideMessenger.ide,
  );

  const editingFileContents = await extras.ideMessenger.ide.readFile(fileUri);
  const newFileContents = executeFindAndReplace(
    editingFileContents,
    oldString,
    newString,
    replaceAll ?? false,
    0,
  );

  // Apply the changes to the file
  const streamId = uuid();
  void extras.dispatch(
    applyForEditTool({
      streamId,
      toolCallId,
      text: newFileContents,
      filepath: fileUri,
      isSearchAndReplace: true,
    }),
  );

  // Return success - applyToFile will handle the completion state
  return {
    respondImmediately: false, // Let apply state handle completion
    output: undefined,
  };
};
