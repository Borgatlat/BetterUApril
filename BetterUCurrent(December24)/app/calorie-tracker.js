import React from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { CalorieTracker } from '../components/CalorieTracker';

export default function CalorieTrackerScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <CalorieTracker />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
}); 