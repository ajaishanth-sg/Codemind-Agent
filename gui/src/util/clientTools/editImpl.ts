import { inferResolvedUriFromRelativePath, resolveRelativePathInDir } from "core/util/ideUtils";
import { v4 as uuid } from "uuid";
import { applyForEditTool } from "../../redux/thunks/handleApplyStateUpdate";
import { ClientToolImpl } from "./callClientTool";

export const editToolImpl: ClientToolImpl = async (
  args,
  toolCallId,
  extras,
) => {
  const filepathRaw =
    args.filepath ?? args.path ?? args.file ?? args.filename;
  const changes =
    args.changes ?? args.content ?? args.code ?? args.text ?? args.new_content;

  if (!filepathRaw || changes === undefined || changes === null) {
    throw new Error(
      "`filepath` and `changes` arguments are required to edit a file.",
    );
  }

  let filepath = String(filepathRaw).trim();
  if (filepath.startsWith("./")) {
    filepath = filepath.slice(2);
  }

  let firstUriMatch = await resolveRelativePathInDir(
    filepath,
    extras.ideMessenger.ide,
  );

  if (!firstUriMatch) {
    firstUriMatch = await inferResolvedUriFromRelativePath(
      filepath,
      extras.ideMessenger.ide,
    );
  }

  if (!firstUriMatch) {
    const openFiles = await extras.ideMessenger.ide.getOpenFiles();
    for (const uri of openFiles) {
      if (uri.endsWith(filepath)) {
        firstUriMatch = uri;
        break;
      }
    }
  }

  if (!firstUriMatch) {
    // If file doesn't exist, resolve path in first workspace directory so it can be created/edited
    const workspaceDirs = await extras.ideMessenger.ide.getWorkspaceDirs();
    if (workspaceDirs.length > 0) {
      const base = workspaceDirs[0].replace(/\/+$/, "");
      const cleanRel = filepath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
      firstUriMatch = `${base}/${cleanRel}`;
    } else {
      throw new Error(`File ${filepath} does not exist and no workspace directory found.`);
    }
  }

  const streamId = uuid();
  void extras.dispatch(
    applyForEditTool({
      streamId,
      text: String(changes),
      toolCallId,
      filepath: firstUriMatch,
    }),
  );

  return {
    respondImmediately: false,
    output: undefined,
  };
};
