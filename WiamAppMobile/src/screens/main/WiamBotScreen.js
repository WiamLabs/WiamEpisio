import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Keyboard,
  Dimensions
} from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import AppBackground from '../../components/AppBackground';
import botApi from '../../api/bot';
import { Send, Bot, User, ChevronLeft, Info, Crown } from 'lucide-react-native';
import useAuthStore from '../../store/useAuthStore';

const { width } = Dimensions.get('window');

const WiamBotScreen = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const isPremium = user?.premium_status === 'active' || user?.premium_status === 'trial';
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      text: "Welcome to WiamBot! I'm your AI assistant for WiamApp. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [dailyLimit, setDailyLimit] = useState(5);
  const flatListRef = useRef();

  // Fetch bot status on mount
  useEffect(() => {
    botApi.getStatus().then((s) => {
      setRemaining(s.remaining_today);
      setDailyLimit(s.daily_limit);
    });
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const response = await botApi.sendMessage(userMessage.text);
      if (response.remaining_today !== undefined) setRemaining(response.remaining_today);
      if (response.daily_limit !== undefined) setDailyLimit(response.daily_limit);
      
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: response.message || "I'm sorry, I couldn't process that. Can you rephrase?",
        sender: 'bot',
        timestamp: new Date(),
        links: response.links || [],
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      let errorText = "I'm having trouble connecting right now. Please try again later.";
      if (error?.rateLimited) {
        setRemaining(0);
        errorText = error.upgrade_hint
          ? "You've reached your daily message limit. Upgrade to WiamPremium for more messages!"
          : "You've reached your daily message limit. It resets at midnight UTC.";
      }
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: 'bot',
        timestamp: new Date(),
        isError: true,
        showUpgrade: !!error?.upgrade_hint,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isBot = item.sender === 'bot';
    
    return (
      <View style={[
        styles.messageContainer,
        isBot ? styles.botMessageContainer : styles.userMessageContainer
      ]}>
        {isBot && (
          <View style={styles.botIconContainer}>
            <Bot size={16} color={COLORS.secondary} />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          isBot ? styles.botBubble : styles.userBubble,
          item.isError && styles.errorBubble
        ]}>
          <Text style={[
            styles.messageText,
            isBot ? styles.botMessageText : styles.userMessageText
          ]}>
            {item.text}
          </Text>
          {item.links && item.links.length > 0 && (
            <View style={styles.linksContainer}>
              {item.links.map((link, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.linkButton}
                  onPress={() => {/* Handle internal navigation or external link */}}
                >
                  <Text style={styles.linkText}>{link.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {item.showUpgrade && !isPremium && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(192,132,252,0.15)', borderRadius: 8, padding: 8 }}
              onPress={() => navigation.navigate('PremiumScreen')}
            >
              <Crown size={14} color="#c084fc" />
              <Text style={{ color: '#c084fc', fontSize: 12, fontWeight: '700' }}>Upgrade to Premium</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {!isBot && (
          <View style={styles.userIconContainer}>
            <User size={16} color={COLORS.primaryLight} />
          </View>
        )}
      </View>
    );
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>WiamBot</Text>
            <View style={styles.onlineIndicator}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Always Online</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.infoButton}>
            <Info size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Daily limit indicator */}
        {remaining !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, backgroundColor: 'rgba(212,168,67,0.08)', gap: 6 }}>
            <Text style={{ color: remaining > 0 ? COLORS.textMuted : '#f87171', fontSize: 11, fontWeight: '600' }}>
              {remaining > 0 ? `${remaining}/${dailyLimit} messages remaining today` : 'Daily limit reached'}
            </Text>
            {!isPremium && (
              <TouchableOpacity onPress={() => navigation.navigate('PremiumScreen')}>
                <Text style={{ color: '#c084fc', fontSize: 11, fontWeight: '700' }}>Get more</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Chat List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.chatListContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input Area */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask me anything..."
              placeholderTextColor={COLORS.textMuted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Send size={20} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: 'rgba(8, 8, 26, 0.8)',
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 4,
  },
  onlineText: {
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoButton: {
    padding: SPACING.sm,
  },
  chatListContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    alignItems: 'flex-end',
  },
  botMessageContainer: {
    justifyContent: 'flex-start',
    marginRight: 40,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
    marginLeft: 40,
  },
  botIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 168, 67, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1,
    borderBottomColor: 'rgba(212, 168, 67, 0.2)',
  },
  userIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(114, 47, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    borderWidth: 1,
    borderBottomColor: 'rgba(114, 47, 55, 0.2)',
  },
  messageBubble: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    maxWidth: '100%',
  },
  botBubble: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: RADIUS.sm,
  },
  errorBubble: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  botMessageText: {
    color: COLORS.text,
  },
  userMessageText: {
    color: COLORS.white,
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  linksContainer: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  linkButton: {
    backgroundColor: 'rgba(212, 168, 67, 0.1)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 67, 0.2)',
  },
  linkText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputArea: {
    padding: SPACING.md,
    paddingBottom: Platform.OS === 'ios' ? 30 : SPACING.md,
    backgroundColor: 'rgba(8, 8, 26, 0.9)',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: SPACING.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    opacity: 0.5,
  }
});

export default WiamBotScreen;
