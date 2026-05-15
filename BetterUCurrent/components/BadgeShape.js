import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, ClipPath, Path, Rect, Image as SvgImage, G } from 'react-native-svg';
import { normalizeImageUrl } from '../utils/imageUrlHelpers';

/**
 * BadgeShape Component
 * 
 * Creates a shield/pentagon shape (flat top, two diagonal sides meeting at bottom point)
 * Used to clip badge images into this shape - NO square background, only the shield shape
 * 
 * Props:
 * - size: Size of the badge (width and height)
 * - imageUri: URI of the image to display (optional)
 * - children: Fallback content if no image (usually an icon View)
 */
export const BadgeShape = ({ size, imageUri, children, style }) => {
  // Calculate the shield/pentagon path
  // Top is flat, bottom comes to a point
  const width = size;
  const height = size;
  const topWidth = width * 0.85; // Top is slightly narrower for better proportions
  const pointOffset = width * 0.15; // How much the point extends
  
  // Create the pentagon path: flat top, two diagonal sides, point at bottom
  const path = `
    M ${(width - topWidth) / 2} 0
    L ${(width + topWidth) / 2} 0
    L ${width - pointOffset} ${height * 0.75}
    L ${width / 2} ${height}
    L ${pointOffset} ${height * 0.75}
    Z
  `;

  const uniqueId = `badge-shield-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id={uniqueId}>
            <Path d={path} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${uniqueId})`}>
          {/* Background fill for the pentagon shape */}
          <Path 
            d={path} 
            fill="rgba(0, 255, 255, 0.2)" 
          />
          {imageUri ? (
            <SvgImage
              href={{ uri: normalizeImageUrl(imageUri) }}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : null}
        </G>
        {/* Outline around the shield shape - drawn on top so it's always visible */}
        <Path 
          d={path} 
          fill="none"
          stroke="#00ffff"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
      {!imageUri && children && (
        <View style={[StyleSheet.absoluteFill, styles.childrenContainer]} pointerEvents="box-none">
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    // No border, no background - just the clipped shape
  },
  childrenContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});

export default BadgeShape;

