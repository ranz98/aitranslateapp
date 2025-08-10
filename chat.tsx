import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';

import { auth, db, appId } from '@/utils/firebaseConfig';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

type Sender = 'me' | 'other';
type Message = {
  id: string;
  text: string;
  userName: string; // Added to store the sender's name
  sender: Sender;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  avatar?: string;
  userId: string;
  timestamp?: any;
};

// Now accepts a previous message to determine whether to show the name
const ChatMessage = React.memo(({ item, currentUserId, prevItem }: { item: Message; currentUserId: string; prevItem?: Message }) => {
  const isMe = item.userId === currentUserId;
  // Show name only if the sender is different from the previous message
  const showName = !prevItem || prevItem.userId !== item.userId; 
  
  return (
    <View style={[styles.messageRow, isMe ? styles.rowMe : styles.rowOther]}>
      {!isMe && (
        <Image source={{ uri: item.avatar || 'https://i.pravatar.cc/150?img=12' }} style={styles.avatar} />
      )}
      <View style={{ flex: 1 }}>
        {!isMe && showName && (
          // The sender's name with the new style
          <Text style={styles.userNameText}>{item.userName}</Text>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <ThemedText style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
            {item.text}
          </ThemedText>
          <Text style={styles.timeText}>{item.time}</Text>
        </View>
      </View>
    </View>
  );
});

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList<Message>>(null);

  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        router.replace('/');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);

    // Corrected Firestore path
    const messagesRef = collection(db, `/artifacts/${appId}/public/data/chats/general_chat/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribeFirestore = onSnapshot(
      q,
      (querySnapshot) => {
        const msgs: Message[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const ts = data.timestamp?.toDate();
          msgs.push({
            id: doc.id,
            text: data.text,
            userName: data.userName, // Read userName from the document
            userId: data.userId,
            timestamp: ts,
            time: ts ? ts.toLocaleTimeString() : '',
            sender: data.userId === currentUser.uid ? 'me' : 'other',
            avatar: 'https://i.pravatar.cc/150?img=3',
          });
        });
        setMessages(msgs);
        setLoading(false);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      (error) => {
        console.error('Error fetching messages: ', error);
        setLoading(false);
      }
    );

    return () => unsubscribeFirestore();
  }, [currentUser]);

  const sendMessage = async () => {
    if (!input.trim() || !currentUser) return;
    try {
      // Corrected Firestore path
      await addDoc(collection(db, `/artifacts/${appId}/public/data/chats/general_chat/messages`), {
        text: input.trim(),
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Guest', // Save the display name
        timestamp: serverTimestamp(),
      });
      setInput('');
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message: ', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
<TouchableOpacity style={styles.backButton} onPress={() => router.replace('/chatlist')}>
                <Text style={styles.backButtonText}>{'<'}</Text>
            </TouchableOpacity>
            <View>
              <ThemedText style={styles.headerText}>Logged in as: {currentUser?.displayName || 'Guest'}</ThemedText>
              <ThemedText type="title">Chat</ThemedText>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ marginTop: 10, color: '#fff' }}>Loading messages...</Text>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={({ item, index }) => (
                <ChatMessage
                  item={item}
                  currentUserId={currentUser!.uid}
                  prevItem={index > 0 ? messages[index - 1] : undefined}
                />
              )}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.messagesContainer}
              keyboardShouldPersistTaps="handled"
            />

            <View style={styles.inputBar}>
              <TouchableOpacity style={styles.iconButton}>
                <ThemedText>📎</ThemedText>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Type a message"
                multiline
                value={input}
                onChangeText={setInput}
                placeholderTextColor="#ccc"
                paddingVertical={Platform.OS === 'ios' ? 10 : 8}
              />
              <TouchableOpacity
                style={[styles.sendButton, input.trim() ? styles.sendButtonActive : { backgroundColor: '#555' }]}
                onPress={sendMessage}
                disabled={!input.trim()}
              >
                <ThemedText style={styles.sendButtonText}>➤</ThemedText>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#075E54',
  },
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#075E54',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#075E54',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontSize: 12,
  },
  backButton: {
    marginRight: 10,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff4d4d',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messagesContainer: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 6,
  },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  userNameText: {
    color: '#e0e0e0', // Light gray color for the name
    fontSize: 14,
    fontWeight: '600', // Semi-bold font weight
    marginBottom: 4,
    marginLeft: 10, // Indent to match bubble
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  bubbleMe: { backgroundColor: '#25D366', alignSelf: 'flex-end' },
  bubbleOther: { backgroundColor: '#128C7E', alignSelf: 'flex-start' },
  messageText: { fontSize: 16, lineHeight: 20, color: '#fff' },
  messageTextMe: { color: '#fff' },
  messageTextOther: { color: '#fff' },
  timeText: { fontSize: 11, color: '#ddd', marginTop: 4, textAlign: 'right' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderColor: '#ddd',
    backgroundColor: '#075E54',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  iconButton: {
    padding: 8,
    marginRight: 6,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: 12,
    backgroundColor: '#128C7E',
    borderRadius: 20,
    fontSize: 16,
    color: '#fff',
  },
  sendButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#25D366',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});