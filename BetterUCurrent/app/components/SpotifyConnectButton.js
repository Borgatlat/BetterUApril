import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../../lib/supabase';

// This helper speaks to Expo and tidies up the in-app browser once Spotify sends us back.
WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_CLIENT_ID = '572dd6dcdd5a499ebbe3189c6ce427cf';
const SPOTIFY_SCOPES = ['user-read-currently-playing', 'user-read-recently-played'];

// Two URLs Spotify publishes that tell us where to send people and where to swap codes for tokens.
const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token'
};

const STATUS = {
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error'
};

/**
 * Button that handles Spotify's OAuth handshake and saves the results in Supabase.
 * We keep it reusable so any screen can drop it in.
 *
 * @param {{ onConnected?: (payload: { accessToken: string; refreshToken: string; expiresAt: string | null; }) => void }} props
 */
const SpotifyConnectButton = ({ onConnected }) => {
  const [status, setStatus] = useState(STATUS.idle);
  const [errorMessage, setErrorMessage] = useState(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [connectionDetails, setConnectionDetails] = useState(null);

  // `useMemo` gives us a stable redirect URI. `makeRedirectUri` adapts for Expo Go vs. standalone builds.
  const redirectUri = useMemo(() => {
    const generated = AuthSession.makeRedirectUri({
      useProxy: true,
      scheme: 'betteru'
    });

    const rawUri = generated || 'betteru://auth';
    const isExpoGo =
      rawUri.startsWith('exp://') ||
      rawUri.includes('auth.expo.io');

    const finalUri = isExpoGo ? rawUri : 'betteru://auth';

    console.log('Spotify redirect URI (resolved):', finalUri, {
      isExpoGo,
      raw: rawUri
    });

    return finalUri;
  }, []);

  // Prepares the sign-in request and hands back helpers to launch Spotify's login page.
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SPOTIFY_SCOPES,
      usePKCE: false,
      responseType: AuthSession.ResponseType.Code,
      redirectUri,
      extraParams: {
        show_dialog: 'true'
      }
    },
    discovery
  );

  useEffect(() => {
    let cancelled = false;

    const loadExistingConnection = async () => {
      setCheckingConnection(true);
      try {
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (!cancelled) {
            setStatus(STATUS.idle);
            setConnectionDetails(null);
          }
          return;
        }

        const { data, error } = await supabase
          .from('spotify_tokens')
          .select('updated_at, expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (!cancelled) {
          if (data) {
            setStatus(STATUS.success);
            setConnectionDetails({
              updatedAt: data.updated_at ?? null,
              expiresAt: data.expires_at ?? null
            });
            setErrorMessage(null);
          } else {
            setStatus(STATUS.idle);
            setConnectionDetails(null);
          }
        }
      } catch (error) {
        console.error('Spotify status lookup failed', error);
        if (!cancelled) {
          setStatus(STATUS.error);
          setErrorMessage('Unable to check Spotify connection. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setCheckingConnection(false);
        }
      }
    };

    loadExistingConnection();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectPress = useCallback(async () => {
    if (checkingConnection || status === STATUS.loading) {
      return;
    }

    setErrorMessage(null);
    setStatus(STATUS.loading);

    try {
      const shouldUseProxy =
        redirectUri.startsWith('exp://') ||
        redirectUri.startsWith('http');

      const result = await promptAsync({ useProxy: shouldUseProxy });

      if (result.type === 'dismiss' || result.type === 'cancel') {
        setStatus(connectionDetails ? STATUS.success : STATUS.idle);
        return;
      }

      if (result.type === 'error') {
        throw new Error(result.error?.description ?? 'Spotify login failed.');
      }
      // Successful response is handled in the useEffect below.
    } catch (error) {
      console.error('Spotify auth launch failed', error);
      setErrorMessage(error.message ?? 'We could not open Spotify. Please try again.');
      setStatus(connectionDetails ? STATUS.success : STATUS.error);
    }
  }, [promptAsync, checkingConnection, status, connectionDetails]);

  useEffect(() => {
    const handleAuthResponse = async () => {
      if (!request || !response) {
        return;
      }

      if (response.type === 'error') {
        console.error('Spotify auth error:', response);
        setErrorMessage('Spotify sign-in failed. Please try again.');
        setStatus(connectionDetails ? STATUS.success : STATUS.error);
        return;
      }

      if (response.type !== 'success') {
        return;
      }

      const { code } = response.params ?? {};

      if (!code) {
        console.error('Spotify auth success missing authorization code.');
        setErrorMessage('Spotify did not provide a valid authorization code.');
        setStatus(STATUS.error);
        return;
      }

      setCheckingConnection(true);

      try {
        console.log('Spotify auth code:', code);

        const {
          data: tokenPayload,
          error: functionError
        } = await supabase.functions.invoke('spotify-token', {
          body: { code, redirectUri }
        });

        if (functionError) {
          throw new Error(functionError.message ?? 'Failed to exchange Spotify authorization code.');
        }

        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error('You must be signed in before connecting Spotify.');
        }

        const expiresAt =
          typeof tokenPayload.expires_in === 'number'
            ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
            : null;

        const { error: upsertError } = await supabase
          .from('spotify_tokens')
          .upsert({
            user_id: user.id,
            access_token: tokenPayload.access_token,
            refresh_token: tokenPayload.refresh_token ?? null,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          });

        if (upsertError) {
          console.error('Spotify token upsert error:', upsertError);
          throw new Error('Failed to store Spotify tokens.');
        }

        setStatus(STATUS.success);
        setConnectionDetails({
          updatedAt: new Date().toISOString(),
          expiresAt
        });
        setErrorMessage(null);

        Alert.alert('Spotify connected!', 'Your Spotify account is now linked to BetterU.');

        if (typeof onConnected === 'function') {
          onConnected({
            accessToken: tokenPayload.access_token,
            refreshToken: tokenPayload.refresh_token ?? null,
            expiresAt
          });
        }
      } catch (error) {
        console.error('Spotify token exchange failed', error);
        setErrorMessage(error.message ?? 'We could not finish connecting to Spotify.');
        setStatus(STATUS.error);
      } finally {
        setCheckingConnection(false);
      }
    };

    handleAuthResponse();
  }, [request, response, onConnected, redirectUri]);

  const handleDisconnect = useCallback(async () => {
    setErrorMessage(null);
    setCheckingConnection(true);
    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setStatus(STATUS.idle);
        setConnectionDetails(null);
        return;
      }

      const { error } = await supabase
        .from('spotify_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      const { data: remaining, error: verifyError } = await supabase
        .from('spotify_tokens')
        .select('user_id')
        .eq('user_id', user.id);

      if (verifyError) {
        throw verifyError;
      }

      if (remaining && remaining.length > 0) {
        console.warn('Spotify disconnect: tokens still found after delete attempt', remaining);
        throw new Error('Could not remove Spotify tokens. Please try again.');
      }

      try {
        await WebBrowser.openBrowserAsync('https://accounts.spotify.com/logout');
      } catch (browserError) {
        console.warn('Spotify logout browser flow failed to open:', browserError);
      }

      setStatus(STATUS.idle);
      setConnectionDetails(null);
      Alert.alert('Spotify disconnected', 'You can reconnect at any time.');
    } catch (error) {
      console.error('Spotify disconnect failed', error);
      setStatus(STATUS.error);
      setErrorMessage(error.message ?? 'Could not disconnect Spotify.');
    } finally {
      setCheckingConnection(false);
    }
  }, []);

  const isLoading = status === STATUS.loading;
  const isSuccess = status === STATUS.success;
  const isBusy = isLoading || checkingConnection;
  const buttonLabel = isSuccess ? 'Reconnect Spotify' : 'Connect Spotify';
  const connectedAtText = isSuccess
    ? `Connected ✅${connectionDetails?.updatedAt ? ` • ${new Date(connectionDetails.updatedAt).toLocaleString()}` : ''}`
    : null;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.button,
          isSuccess ? styles.buttonSuccess : styles.buttonPrimary,
          isBusy && styles.buttonDisabled
        ]}
        onPress={handleConnectPress}
        disabled={isBusy}
        activeOpacity={0.8}
      >
        {isBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={styles.buttonContent}>
            <Ionicons
              name={isSuccess ? 'refresh' : 'musical-notes'}
              size={18}
              color="#fff"
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </View>
        )}
      </TouchableOpacity>
      {connectedAtText && (
        <Text style={styles.connectionMeta}>{connectedAtText}</Text>
      )}
      {isSuccess && (
        <TouchableOpacity
          style={[styles.disconnectButton, isBusy && styles.buttonDisabled]}
          onPress={handleDisconnect}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          {isBusy ? (
            <ActivityIndicator color="#1DB954" />
          ) : (
            <View style={styles.disconnectContent}>
              <Ionicons name="log-out-outline" size={18} color="#fb7185" style={styles.buttonIcon} />
              <Text style={styles.disconnectButtonText}>Disconnect Spotify</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
      {errorMessage && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center'
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    minWidth: 240,
    alignItems: 'center',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6
  },
  buttonPrimary: {
    backgroundColor: '#1DB954'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonSuccess: {
    backgroundColor: '#16a34a'
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonIcon: {
    marginRight: 8
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  connectionMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center'
  },
  disconnectButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    minWidth: 240,
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 133, 0.12)'
  },
  disconnectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  disconnectButtonText: {
    color: '#fb7185',
    fontSize: 14,
    fontWeight: '600'
  },
  errorText: {
    color: '#d9534f',
    marginTop: 12,
    textAlign: 'center'
  }
});

export default SpotifyConnectButton;

