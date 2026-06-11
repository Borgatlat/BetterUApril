import React, { useRef, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useHomeScroll } from '../context/HomeScrollContext';

/**
 * Wraps a Home section so the tutorial can measure its on-screen position.
 * `measureInWindow` returns x/y relative to the device screen — same coordinate
 * system the tutorial overlay uses for the cyan highlight box.
 */
export function TutorialAnchor({ anchorKey, children, style }) {
  const viewRef = useRef(null);
  const homeScroll = useHomeScroll();

  const measure = useCallback(() => {
    const node = viewRef.current;
    if (!node?.measureInWindow || !homeScroll?.reportAnchorBounds) return;
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        homeScroll.reportAnchorBounds(anchorKey, { x, y, width, height });
      }
    });
  }, [anchorKey, homeScroll]);

  useEffect(() => {
    if (!homeScroll?.registerAnchor) return undefined;
    return homeScroll.registerAnchor(anchorKey, viewRef, measure);
  }, [anchorKey, measure, homeScroll]);

  return (
    <View ref={viewRef} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
}
