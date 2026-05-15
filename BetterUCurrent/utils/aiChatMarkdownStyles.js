import { Platform } from 'react-native';

/**
 * Markdown style objects for react-native-markdown-display.
 * Match each AI chat surface (Atlas = cyan, Eleos = purple).
 */

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export const atlasMarkdownStyles = {
  body: { color: '#fff', fontSize: 14, lineHeight: 20 },
  paragraph: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  strong: { fontWeight: '800', color: '#e0f7ff' },
  em: { fontStyle: 'italic', color: '#cbd5e1' },
  heading1: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
  heading2: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heading3: { fontSize: 15, fontWeight: '700', color: '#a5f3fc', marginBottom: 4 },
  bullet_list: { marginTop: 4, marginBottom: 6 },
  ordered_list: { marginTop: 4, marginBottom: 6 },
  list_item: { color: '#e2e8f0', marginBottom: 2 },
  link: { color: '#22d3ee', textDecorationLine: 'underline' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#00ffff',
    paddingLeft: 10,
    marginVertical: 6,
    color: '#cbd5e1',
  },
  code_inline: {
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    color: '#a5f3fc',
    fontFamily: mono,
    fontSize: 13,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    color: '#e2e8f0',
    fontSize: 12,
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
};

export const eleosMarkdownStyles = {
  body: { color: '#fff', fontSize: 14, lineHeight: 20 },
  paragraph: { color: '#fff', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  strong: { fontWeight: '800', color: '#f5f3ff' },
  em: { fontStyle: 'italic', color: '#d8b4fe' },
  heading1: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 8 },
  heading2: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 6 },
  heading3: { fontSize: 15, fontWeight: '700', color: '#e9d5ff', marginBottom: 4 },
  bullet_list: { marginTop: 4, marginBottom: 6 },
  ordered_list: { marginTop: 4, marginBottom: 6 },
  list_item: { color: '#e2e8f0', marginBottom: 2 },
  link: { color: '#c4b5fd', textDecorationLine: 'underline' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
    paddingLeft: 10,
    marginVertical: 6,
    color: '#ddd6fe',
  },
  code_inline: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    color: '#e9d5ff',
    fontFamily: mono,
    fontSize: 13,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  fence: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    color: '#e2e8f0',
    fontSize: 12,
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
};
