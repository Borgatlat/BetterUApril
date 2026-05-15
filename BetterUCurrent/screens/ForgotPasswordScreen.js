"use client"

import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { supabase } from "../lib/supabase"
import TurnstileCaptcha from "../components/TurnstileCaptcha"
import { TURNSTILE_CONFIG } from "../config/turnstile"

// Get screen dimensions for responsive design
const { width, height } = Dimensions.get("window")
const isIphoneX = Platform.OS === "ios" && (height >= 812 || width >= 812)

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [captchaToken, setCaptchaToken] = useState("")
  const [captchaError, setCaptchaError] = useState("")

  const handleResetPassword = async () => {
    if (email === "") {
      setError("Please enter your email")
      Alert.alert("Error", "Please enter your email")
      return
    }

    if (!captchaToken) {
      setError("Please complete the captcha verification")
      Alert.alert("Error", "Please complete the captcha verification")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "betteru://reset-password",
      })

      if (error) {
        setError(error.message)
        Alert.alert("Error", error.message)
      } else {
        Alert.alert("Password Reset Email Sent", "Check your email for a password reset link", [
          { text: "OK", onPress: () => navigation.navigate("Login") },
        ])
      }
    } catch (error) {
      setError("An unexpected error occurred")
      Alert.alert("Error", "An unexpected error occurred")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.contentContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <View style={styles.formContainer}>
              <Text style={styles.title}>Forgot Password</Text>
              <Text style={styles.subtitle}>Enter your email to receive a password reset link</Text>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={22} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#888"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Captcha Verification */}
              <View style={styles.captchaContainer}>
                <View style={styles.captchaHeader}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#00ffff" />
                  <Text style={styles.captchaLabel}>Security Verification</Text>
                </View>
                <Text style={styles.captchaSubtitle}>
                  Complete this quick verification to protect your account
                </Text>
                <TurnstileCaptcha
                  siteKey={TURNSTILE_CONFIG.SITE_KEY}
                  onVerify={(token) => {
                    setCaptchaToken(token);
                    setCaptchaError("");
                  }}
                  onError={(message) => {
                    setCaptchaError(message);
                    setCaptchaToken("");
                  }}
                  style={styles.captcha}
                />
                {captchaError ? (
                  <View style={styles.captchaErrorContainer}>
                    <Ionicons name="alert-circle-outline" size={16} color="#ff6b6b" />
                    <Text style={styles.captchaErrorText}>{captchaError}</Text>
                  </View>
                ) : null}
                {captchaToken ? (
                  <View style={styles.captchaSuccessContainer}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#00ff88" />
                    <Text style={styles.captchaSuccessText}>Verification complete!</Text>
                  </View>
                ) : null}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity 
                style={[
                  styles.button,
                  !captchaToken && styles.buttonDisabled
                ]} 
                onPress={handleResetPassword} 
                disabled={isLoading || !captchaToken}
              >
                {isLoading ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Text style={[
                    styles.buttonText,
                    !captchaToken && styles.buttonTextDisabled
                  ]}>
                    {captchaToken ? 'Send Reset Link' : 'Complete Captcha to Continue'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.backToLoginButton} onPress={() => navigation.navigate("Login")}>
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "black",
    paddingTop: Platform.OS === "ios" ? (isIphoneX ? 50 : 20) : 0,
  },
  container: {
    flexGrow: 1,
    backgroundColor: "black",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  contentContainer: {
    width: "90%",
    maxWidth: 400,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  formContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    padding: 25,
    width: "100%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#B3B3B3",
    marginBottom: 30,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  inputIcon: {
    marginHorizontal: 15,
  },
  input: {
    flex: 1,
    height: 50,
    color: "white",
    paddingRight: 15,
  },
  errorText: {
    color: "#FF6B6B",
    marginBottom: 15,
    textAlign: "center",
  },
  button: {
    backgroundColor: "cyan",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "bold",
  },
  backToLoginButton: {
    alignItems: "center",
    marginTop: 20,
  },
  backToLoginText: {
    color: "cyan",
    fontSize: 16,
  },
  buttonDisabled: {
    backgroundColor: "#666",
    opacity: 0.6,
  },
  buttonTextDisabled: {
    color: "#999",
  },
  captchaContainer: {
    marginBottom: 25,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  captchaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  captchaLabel: {
    fontSize: 16,
    color: '#00ffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  captchaSubtitle: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 18,
  },
  captcha: {
    width: '100%',
    height: 150,
  },
  captchaErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  captchaErrorText: {
    color: '#ff6b6b',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  captchaSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  captchaSuccessText: {
    color: '#00ff88',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
})

export default ForgotPasswordScreen

