import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';

import { auth, db, appId } from '@/utils/firebaseConfig';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore'; // ⬅️ Import 'where'

type Chat = {
  id: string;
  chatName: string;
  lastMessageText: string;
  lastMessageTimestamp: any;
};

export default function ChatList() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

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
    const chatsRef = collection(db, `/artifacts/${appId}/public/data/chats`);
    
    // ⬅️ FIX: Add a `where` clause to filter chats by the current user's UID
    const q = query(
      chatsRef,
      where('members', 'array-contains', currentUser.uid), // ⬅️ Only get chats where the user is a member
      orderBy('lastMessageTimestamp', 'desc')
    );

    const unsubscribeChats = onSnapshot(
      q,
      (querySnapshot) => {
        const chatList: Chat[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          chatList.push({
            id: docSnap.id,
            chatName: data.chatName || 'Unnamed Chat',
            lastMessageText: data.lastMessageText || '',
            lastMessageTimestamp: data.lastMessageTimestamp || null,
          });
        });
        setChats(chatList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching chat list:', error);
        setLoading(false);
      }
    );

    return () => unsubscribeChats();
  }, [currentUser]); // ⬅️ The useEffect hook now depends on `currentUser`
  
  const handleNewChat = () => {
    router.push('/all-users');
  };

  const openChat = (chatId: string) => {
    router.push(`/chat?chatId=${chatId}`);
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Chats</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleNewChat} style={styles.headerButton}>
            <Text style={styles.buttonText}>New Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#075E54" />
          <Text>Loading chats...</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.chatItem} onPress={() => openChat(item.id)}>
              <Text style={styles.chatTitle}>{item.chatName}</Text>
              <Text style={styles.chatLastMessage} numberOfLines={1}>
                {item.lastMessageText || 'No messages yet'}
              </Text>
              <Text style={styles.chatTimestamp}>
                {item.lastMessageTimestamp?.toDate
                  ? item.lastMessageTimestamp.toDate().toLocaleString()
                  : ''}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#075E54',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#25D366',
    borderRadius: 8,
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff4d4d',
    borderRadius: 8,
    marginLeft: 8,
  },
  logoutText: { color: '#fff', fontWeight: 'bold' },
  chatItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  chatTitle: { fontWeight: '600', marginBottom: 4 },
  chatLastMessage: { color: '#555' },
  chatTimestamp: { fontSize: 10, color: '#888', marginTop: 4 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});