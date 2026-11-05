; AISTOC Agent installer overrides.
; perMachine: true gives the UAC prompt; preInit pins the actual install
; directory to the invoking user's LOCALAPPDATA as the product requires.

!include "LogicLib.nsh"

; MUI2 defines .onUserAbort itself; the supported hooks are the two defines
; below (confirmation text, then our cleanup callback). These must be defined
; before the template includes MUI2, but they pull in nothing else. The
; uninstaller build compiles this same file, where neither the callback nor
; the components page exists (defining the callback without its function
; would make MUI's .onUserAbort fail to resolve).
!ifndef BUILD_UNINSTALLER
  !define MUI_ABORTWARNING
  !define MUI_ABORTWARNING_TEXT "确定要取消安装吗？已写入的文件和快捷方式将被清理。"
  !define MUI_CUSTOMFUNCTION_ABORT "AistocCleanupOnAbort"

  ; The installer-only components page and its state. The uninstaller compile
  ; rejects unreferenced Vars (warnings are errors), so it sees none of this.
  Var AISTOC_INSTDIR_PREEXISTED
  Var AISTOC_DESKTOP_SHORTCUT
  Var AISTOC_STARTMENU_SHORTCUT
  Var AISTOC_DESKTOP_CREATED
  Var AISTOC_STARTMENU_CREATED
  Var AISTOC_PYTHON_STATUS
  Var AISTOC_NODE_STATUS
  Var AISTOC_FFMPEG_STATUS
  Var AISTOC_COMPONENTS_DIALOG
  Var AISTOC_DESKTOP_CHECKBOX
  Var AISTOC_STARTMENU_CHECKBOX
!endif

!macro preInit
  SetShellVarContext current
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\AISTOC Agent"
  !ifndef BUILD_UNINSTALLER
    ${If} ${FileExists} "$INSTDIR\*.*"
      StrCpy $AISTOC_INSTDIR_PREEXISTED "1"
    ${Else}
      StrCpy $AISTOC_INSTDIR_PREEXISTED "0"
    ${EndIf}
  !endif
!macroend

!macro customPageAfterChangeDir
  Page custom AistocComponentsPageCreate AistocComponentsPageLeave
!macroend

!macro customInit
  ; The progress page shows this as the step it is running. The generated
  ; installer has exactly one Section (the "install" section, index 0);
  ; INSTALL_SECTION_ID is not defined yet where customInit expands.
  SectionSetText 0 "正在安装 AISTOC Agent 主程序和内置运行环境"
  ; Silent/update installs skip the page; keep the user's existing choices.
  ${If} ${isUpdated}
    ${IfNot} ${FileExists} "$DESKTOP\${SHORTCUT_NAME}.lnk"
      StrCpy $AISTOC_DESKTOP_SHORTCUT "0"
    ${EndIf}
    !ifdef MENU_FILENAME
      ${IfNot} ${FileExists} "$SMPROGRAMS\${MENU_FILENAME}\${SHORTCUT_NAME}.lnk"
        StrCpy $AISTOC_STARTMENU_SHORTCUT "0"
      ${EndIf}
    !endif
  ${EndIf}
!macroend

!macro customInstall
  ; electron-builder creates shortcuts at build time; this build creates them
  ; here so the components page controls them.
  ${If} $AISTOC_PYTHON_STATUS != ""
    DetailPrint "系统 Python：$AISTOC_PYTHON_STATUS（本次仍使用内置固定版本）"
  ${EndIf}
  ${If} $AISTOC_NODE_STATUS != ""
    DetailPrint "系统 Node.js：$AISTOC_NODE_STATUS（本次仍使用内置固定版本）"
  ${EndIf}

  ${If} $AISTOC_DESKTOP_SHORTCUT != "0"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    StrCpy $AISTOC_DESKTOP_CREATED "1"
    DetailPrint "已创建桌面快捷方式"
  ${Else}
    DetailPrint "已跳过桌面快捷方式"
  ${EndIf}

  ${If} $AISTOC_STARTMENU_SHORTCUT != "0"
    !ifdef MENU_FILENAME
      CreateDirectory "$SMPROGRAMS\${MENU_FILENAME}"
    !endif
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    StrCpy $AISTOC_STARTMENU_CREATED "1"
    DetailPrint "已创建开始菜单快捷方式"
  ${Else}
    DetailPrint "已跳过开始菜单快捷方式"
  ${EndIf}

  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  ; Shortcut creation is user-optional, so the template's DO_NOT_CREATE_*
  ; guard skips its cleanup; remove both links ourselves.
  WinShell::UninstShortcut "$oldDesktopLink"
  Delete "$oldDesktopLink"
  WinShell::UninstShortcut "$oldStartMenuLink"
  Delete "$oldStartMenuLink"
  !ifdef MENU_FILENAME
    ReadRegStr $R1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" MenuDirectory
    ${If} $R1 != ""
      RMDir "$SMPROGRAMS\$R1"
    ${EndIf}
  !endif

  ; Ask before removing user data. Default is "No" (keep data).
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否删除 AISTOC Agent 的本地数据（会话、配置、密钥）？选择“否”将保留。" IDNO aistoc_keep_data
  RMDir /r "$APPDATA\AISTOC Agent"
  aistoc_keep_data:
!macroend

; Expanded after installer.nsi has included MUI2 (which itself includes
; nsDialogs) and declared the page sequence, and after the Var declarations —
; so this file adds no include ahead of the template (that reordered plugin
; resolution and broke the NSIS build).
!macro customHeader
  !ifndef BUILD_UNINSTALLER
  ; Informational only: detect the tools a user may already have. AISTOC still
  ; ships its own pinned runtime and never touches the system installation.
  Function AistocDetectRuntimes
    StrCpy $AISTOC_PYTHON_STATUS "未检测到"
    StrCpy $AISTOC_NODE_STATUS "未检测到"
    StrCpy $AISTOC_FFMPEG_STATUS "未检测到"

    ; py.exe only exists for a real CPython install; the WindowsApps python.exe
    ; app-execution alias would otherwise open the Microsoft Store.
    nsExec::ExecToStack 'cmd /c py -3 --version 2>&1'
    Pop $0
    Pop $1
    ${If} $0 == "0"
      StrCpy $AISTOC_PYTHON_STATUS "已检测到"
    ${EndIf}

    nsExec::ExecToStack 'cmd /c where node 2>&1'
    Pop $0
    Pop $1
    ${If} $0 == "0"
      StrCpy $AISTOC_NODE_STATUS "已检测到"
    ${EndIf}

    nsExec::ExecToStack 'cmd /c where ffmpeg 2>&1'
    Pop $0
    Pop $1
    ${If} $0 == "0"
      StrCpy $AISTOC_FFMPEG_STATUS "已检测到"
    ${EndIf}
  FunctionEnd

  Function AistocComponentsPageCreate
    ; Updates keep the user's existing shortcut choices; the page is fresh-install only.
    ${If} ${isUpdated}
      Abort
    ${EndIf}

    !insertmacro MUI_HEADER_TEXT "选择安装内容" "选择要安装的内容。"
    nsDialogs::Create 1018
    Pop $AISTOC_COMPONENTS_DIALOG
    ${If} $AISTOC_COMPONENTS_DIALOG == error
      Abort
    ${EndIf}

    Call AistocDetectRuntimes

    ${NSD_CreateLabel} 0 0 100% 10u "运行环境检测（仅提示，不修改系统）："
    ${NSD_CreateLabel} 0 12u 100% 10u "  • 系统 Python：$AISTOC_PYTHON_STATUS"
    ${NSD_CreateLabel} 0 24u 100% 10u "  • 系统 Node.js：$AISTOC_NODE_STATUS"
    ${NSD_CreateLabel} 0 36u 100% 10u "  • 系统 ffmpeg：$AISTOC_FFMPEG_STATUS"
    ${NSD_CreateLabel} 0 50u 100% 22u "AISTOC 使用内置固定版本，不安装到系统、不改 PATH，也不会出现在“已安装的应用”中。"

    ${NSD_CreateCheckbox} 0 76u 100% 12u "AISTOC Agent 主程序与内置运行环境（必需）"
    Pop $0
    SendMessage $0 ${BM_SETCHECK} ${BST_CHECKED} 0
    EnableWindow $0 0

    ${NSD_CreateCheckbox} 0 96u 100% 12u "创建桌面快捷方式"
    Pop $AISTOC_DESKTOP_CHECKBOX
    SendMessage $AISTOC_DESKTOP_CHECKBOX ${BM_SETCHECK} ${BST_CHECKED} 0

    ${NSD_CreateCheckbox} 0 110u 100% 12u "创建开始菜单快捷方式"
    Pop $AISTOC_STARTMENU_CHECKBOX
    SendMessage $AISTOC_STARTMENU_CHECKBOX ${BM_SETCHECK} ${BST_CHECKED} 0

    nsDialogs::Show
  FunctionEnd

  Function AistocComponentsPageLeave
    SendMessage $AISTOC_DESKTOP_CHECKBOX ${BM_GETCHECK} 0 0
    StrCpy $AISTOC_DESKTOP_SHORTCUT $0
    SendMessage $AISTOC_STARTMENU_CHECKBOX ${BM_GETCHECK} 0 0
    StrCpy $AISTOC_STARTMENU_SHORTCUT $0
  FunctionEnd

  ; MUI calls this from its own .onUserAbort after the user confirms.
  Function AistocCleanupOnAbort
    ${If} $AISTOC_DESKTOP_CREATED == "1"
    ${AndIf} $newDesktopLink != ""
      Delete "$newDesktopLink"
    ${EndIf}
    ${If} $AISTOC_STARTMENU_CREATED == "1"
    ${AndIf} $newStartMenuLink != ""
      Delete "$newStartMenuLink"
    ${EndIf}

    ${If} $AISTOC_INSTDIR_PREEXISTED == "0"
    ${AndIf} $INSTDIR != ""
      RMDir /r "$INSTDIR"
    ${Else}
      DetailPrint "升级已取消：原有程序文件保持不变，请重新运行安装包完成升级。"
    ${EndIf}
  FunctionEnd
  !endif
!macroend
