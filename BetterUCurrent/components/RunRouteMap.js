import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker, getMapProvider } from '../lib/MapView';
import {
  parseRunPath,
  calculateRunMapRegion,
  downsampleRunPath,
} from '../utils/runPathMap';

const mapProvider = getMapProvider();

/**
 * Safe route map for feeds and detail screens.
 * Use interactable=false inside ScrollView / FlatList to avoid native crashes.
 */
export default function RunRouteMap({
  path,
  strokeColor = '#00ffff',
  style,
  interactable = false,
  showsCompass = false,
  showsScale = false,
}) {
  const coordinates = useMemo(
    () => downsampleRunPath(parseRunPath(path)),
    [path]
  );
  const region = useMemo(
    () => calculateRunMapRegion(coordinates),
    [coordinates]
  );

  if (!region || coordinates.length < 2) {
    return null;
  }

  return (
    <MapView
      style={[styles.map, style]}
      initialRegion={region}
      region={region}
      provider={mapProvider}
      scrollEnabled={interactable}
      zoomEnabled={interactable}
      rotateEnabled={interactable}
      pitchEnabled={interactable}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={showsCompass}
      showsScale={showsScale}
      loadingEnabled
      cacheEnabled
    >
      <Polyline
        coordinates={coordinates}
        strokeColor={strokeColor}
        strokeWidth={4}
        lineCap="round"
        lineJoin="round"
        geodesic
      />
      <Marker coordinate={coordinates[0]} title="Start">
        <View style={[styles.marker, styles.startMarker]} />
      </Marker>
      <Marker coordinate={coordinates[coordinates.length - 1]} title="End">
        <View style={[styles.marker, styles.endMarker]} />
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    width: '100%',
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  startMarker: {
    backgroundColor: '#00ff88',
  },
  endMarker: {
    backgroundColor: '#ff4444',
  },
});
