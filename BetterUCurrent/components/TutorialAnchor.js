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

  // Keep latest context callbacks in refs so measure/register effects do not
  // re-run when anchorBounds updates change the context value identity.
  const reportAnchorBoundsRef = useRef(homeScroll?.reportAnchorBounds);
  const registerAnchorRef = useRef(homeScroll?.registerAnchor);
  reportAnchorBoundsRef.current = homeScroll?.reportAnchorBounds;
  registerAnchorRef.current = homeScroll?.registerAnchor;

  const measure = useCallback(() => {
    const node = viewRef.current;
    const report = reportAnchorBoundsRef.current;
    if (!node?.measureInWindow || !report) return;
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        report(anchorKey, { x, y, width, height });
      }
    });
  }, [anchorKey]);

  useEffect(() => {
    const register = registerAnchorRef.current;
    if (!register) return undefined;
    return register(anchorKey, viewRef, measure);
  }, [anchorKey, measure]);

  return (
    <View ref={viewRef} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
}
