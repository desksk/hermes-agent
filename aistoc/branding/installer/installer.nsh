; AISTOC Agent installer overrides.
; perMachine: true gives the UAC prompt; preInit pins the actual install
; directory to the invoking user's LOCALAPPDATA as the product requires.
!macro preInit
  SetShellVarContext current
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\AISTOC Agent"
!macroend

; Ask before removing user data. Default is "No" (keep data).
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否删除 AISTOC Agent 的本地数据（会话、配置、密钥）？选择“否”将保留。" IDNO aistoc_keep_data
  RMDir /r "$APPDATA\AISTOC Agent"
  aistoc_keep_data:
!macroend
