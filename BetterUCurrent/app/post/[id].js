import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getActivityRoute } from '../../lib/shareLinks';

/**
 * Legacy share URLs used /post/:id — redirect to the real activity detail screen.
 */
export default function PostShareRedirect() {
  const { id, type } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (id) {
      router.replace(getActivityRoute({ id: String(id), type: type ? String(type) : undefined }));
      return;
    }
    router.replace('/(tabs)/home');
  }, [id, type, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#00ffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});
