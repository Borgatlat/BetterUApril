/**
 * CommunityListRow - Shared list row for Community tab (Strava-style).
 * Same card style for friends, groups, invitations, and search results.
 * Uses COMMUNITY_THEME for consistent look.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COMMUNITY_THEME } from '../../config/communityTheme';

const T = COMMUNITY_THEME;

export default function CommunityListRow({
  leftNode,
  title,
  subtitle,
  rightNode,
  onPress,
  style,
}) {
  const content = (
    <>
      {leftNode}
      <View style={styles.content}>
        {title != null && (
          typeof title === 'string' ? (
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          ) : (
            title
          )
        )}
        {subtitle != null && typeof subtitle === 'string' && (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>
      {rightNode != null ? rightNode : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.row, style]}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.row, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.communityCardBg,
    borderRadius: T.communityRadius,
    paddingVertical: 14,
    paddingHorizontal: T.spacing.md,
    marginBottom: T.spacing.sm,
    borderWidth: 1,
    borderColor: T.communityBorder,
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: T.spacing.md,
    marginRight: T.spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: T.communityTextPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: T.communityTextSecondary,
    marginTop: 2,
  },
});
