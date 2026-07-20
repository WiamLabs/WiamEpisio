import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';

const PreparingScreen = ({ onComplete }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // #SMOOTH FADE IN (Taking 2 seconds to appear)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();

    // #WAIT 6 SECONDS TOTAL (Enough time to read the quote)
    const timer = setTimeout(onComplete, 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Text style={styles.quote}>"Every story is a journey waiting to be traveled."</Text>
        <View style={styles.line} />
        <Text style={styles.brand}>WiamApp</Text>
        
        <ActivityIndicator color="#d4a843" size="large" style={{ marginTop: 40 }} />
        
        <Text style={styles.status}>Curating your personal library...</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#08081a', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40 
  },
  quote: { 
    color: '#e8e6e3', 
    fontSize: 22, 
    textAlign: 'center', 
    fontFamily: 'PlayfairDisplay_700Bold', 
    fontStyle: 'italic',
    lineHeight: 32
  },
  line: {
    width: 40,
    height: 1,
    backgroundColor: '#d4a843',
    marginVertical: 20
  },
  brand: { 
    color: '#d4a843', 
    fontSize: 14, 
    fontWeight: '700', 
    letterSpacing: 4, 
    textTransform: 'uppercase' 
  },
  status: { 
    color: '#8e8e94', 
    fontSize: 13, 
    marginTop: 20, 
    fontWeight: '600',
    letterSpacing: 1
  }
});

export default PreparingScreen;