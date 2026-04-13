"use client"
import { Image, View } from "react-native"
import { useState } from "react"
import { LogoFallback } from "../assets/logo" // Keep fallback for error handling
import * as FileSystem from 'expo-file-system';

// A component that renders the logo
export const LogoImage = ({ style, size = 100 }) => {
  const [imageError, setImageError] = useState(false)

  // If there's an error loading the image, use the fallback component
  if (imageError) {
    return <LogoFallback size={size} style={style} />
  }

  // Calculate dimensions based on the size prop
  const width = size
  const height = size

  return (
    <View
      style={[
        {
          width,
          height,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: size / 2, // Make container perfectly circular
          overflow: "hidden", // Clip the image to the circle
          backgroundColor: "black", // Match the logo's background color
        },
        style,
      ]}
    >
      <Image
        source={require("../assets/images/icon.jpg")}
        style={{
          width: width * 1.1,
          height: height * 1.1,
          resizeMode: "contain",
        }}
        onError={() => setImageError(true)}
        accessibilityLabel="BetterU Logo"
      />
    </View>
  )
}

// Function to preload images
export const preloadImages = async () => {
  try {
    // Preload the logo image
    const images = [
      require("../assets/images/icon.jpg"),
      // Add other images that need preloading here
    ];

    // Use Promise.all to load all images in parallel
    const imagePromises = images.map(image => {
      return new Promise((resolve, reject) => {
        const img = Image.resolveAssetSource(image);
        if (!img || !img.uri) {
          console.warn('Image source not found:', image);
          resolve(); // Resolve instead of reject to continue loading other images
          return;
        }

        Image.prefetch(img.uri)
          .then(() => {
            console.log('Successfully preloaded image:', img.uri);
            resolve();
          })
          .catch(error => {
            console.warn('Failed to preload image:', img.uri, error);
            resolve(); // Resolve instead of reject to continue loading other images
          });
      });
    });

    await Promise.all(imagePromises);
    console.log("All images preloaded successfully");
    return true;
  } catch (error) {
    console.error("Error preloading images:", error);
    // Don't throw the error, just return false
    return false;
  }
};

export const convertImageToBase64 = async (imageUri) => {
  try {
    // Read the image file as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Return the base64 string with data URI prefix
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to convert image to base64');
  }
};

