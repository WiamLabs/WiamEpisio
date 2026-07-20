/**
 * NativeRichEditor — Native rich text editor using @10play/tentap-editor (Tiptap for RN).
 *
 * Replaces the old WebView + contentEditable RichTextEditor.
 * This is a proper native editor component that Apple/Google accept.
 *
 * Props:
 *   initialContent  — HTML string to load into the editor
 *   placeholder     — Placeholder text
 *   onChange         — Called with { html, wordCount, charCount } on content change
 *   style           — Container style overrides
 *   editorRef       — Optional ref to access editor bridge methods
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  RichText,
  Toolbar,
  useEditorBridge,
  DEFAULT_TOOLBAR_ITEMS,
  TenTapStartKit,
  CoreBridge,
  BoldBridge,
  ItalicBridge,
  UnderlineBridge,
  StrikeBridge,
  HeadingBridge,
  BulletListBridge,
  OrderedListBridge,
  BlockquoteBridge,
  HorizontalRuleBridge,
  HistoryBridge,
} from '@10play/tentap-editor';
import { RADIUS } from '../constants/theme';

const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
};

const countWords = (html) => {
  const plain = stripHtml(html);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
};

const NativeRichEditor = ({
  initialContent = '',
  placeholder = 'Start writing your chapter here...',
  onChange,
  style,
  editorRef,
}) => {
  const debounceRef = useRef(null);

  const editor = useEditorBridge({
    initialContent: initialContent || '<p></p>',
    autofocus: true,
    avoidIosKeyboard: true,
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(`
        * { box-sizing: border-box; }
        html, body {
          background: #08081a !important;
        }
        body {
          background: #08081a;
          color: #e8e6e3;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 17px;
          line-height: 1.7;
          padding: 16px 20px 28px;
          margin: 0;
        }
        p { margin-bottom: 0.5em; }
        h1 { font-size: 1.6em; font-weight: 700; margin: 0.6em 0 0.3em; color: #d4a843; }
        h2 { font-size: 1.3em; font-weight: 600; margin: 0.5em 0 0.3em; color: #d4a843; }
        h3 { font-size: 1.1em; font-weight: 600; margin: 0.4em 0 0.2em; color: #d4a843; }
        blockquote {
          border-left: 3px solid #d4a843;
          padding-left: 14px;
          margin: 0.5em 0;
          color: #b5b5ba;
          font-style: italic;
        }
        ul, ol { padding-left: 24px; margin: 0.4em 0; }
        li { margin-bottom: 0.2em; }
        hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1em 0; }
        strong { font-weight: 700; }
        em { font-style: italic; }
        u { text-decoration: underline; }
        s { text-decoration: line-through; color: #8e8e94; }
        .ProseMirror {
          background: #08081a !important;
          color: #e8e6e3 !important;
          min-height: 100% !important;
        }
        .ProseMirror p {
          color: #e8e6e3 !important;
        }
        ::selection { background: rgba(212,168,67,0.3); }
        .ProseMirror-placeholder { color: rgba(255,255,255,0.2); }
      `),
    ],
  });

  // Expose editor bridge to parent via ref
  useEffect(() => {
    if (editorRef) {
      editorRef.current = {
        getHTML: () => editor.getHTML(),
        setContent: (html) => editor.setContent(html),
        focus: () => editor.focus(),
        blur: () => editor.blur(),
        editor,
      };
    }
  }, [editor, editorRef]);

  // Poll for content changes since editor.on() is not available in all tentap versions
  useEffect(() => {
    if (!onChange) return;
    const interval = setInterval(async () => {
      try {
        const html = await editor.getHTML();
        if (html && html !== debounceRef.current) {
          debounceRef.current = html;
          const wc = countWords(html);
          const cc = stripHtml(html).length;
          onChange({ html, wordCount: wc, charCount: cc });
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [editor, onChange]);

  return (
    <View style={[styles.container, style]}>
      <Toolbar
        editor={editor}
        items={DEFAULT_TOOLBAR_ITEMS}
        style={styles.toolbar}
      />
      <RichText
        editor={editor}
        style={styles.richText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  richText: {
    flex: 1,
    backgroundColor: '#08081a',
  },
  toolbar: {
    backgroundColor: '#0f1030',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    minHeight: 46,
    paddingVertical: 2,
  },
});

export default NativeRichEditor;
