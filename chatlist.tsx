import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { auth, db, appId } from '@/utils/firebaseConfig';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';

type Chat = {
  id: string;
  chatName: string;
  lastMessageText: string;
  lastMessageTimestamp: any;
};

const STORAGE_KEY = '@cached_chats';

export default function ChatList() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();

  // Load cached chats from AsyncStorage on mount
  useEffect(() => {
    const loadCachedChats = async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached) {
          setChats(JSON.parse(cached));
          setLoading(false); // stop loading because we have cached data
        }
      } catch (e) {
        console.warn('Failed to load cached chats:', e);
      }
    };
    loadCachedChats();
  }, []);

  // Handle Auth State
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        router.replace('/');
      }
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch chats and listen real-time
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) return;

    setLoading(true);

    const chatsRef = collection(db, `/artifacts/${appId}/public/data/chats`);

    const q = query(
      chatsRef,
      where('members', 'array-contains', currentUser.uid),
      orderBy('lastMessageTimestamp', 'desc')
    );

    const unsubscribeChats = onSnapshot(
      q,
      async (querySnapshot) => {
        const chatList: Chat[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();

          // If timestamp missing, skip or set fallback (here we skip)
          if (!data.lastMessageTimestamp) {
            console.warn(`Chat doc ${docSnap.id} missing lastMessageTimestamp, skipping`);
            return;
          }

          chatList.push({
            id: docSnap.id,
            chatName: data.chatName || 'Unnamed Chat',
            lastMessageText: data.lastMessageText || '',
            lastMessageTimestamp: data.lastMessageTimestamp,
          });
        });

        setChats(chatList);
        setLoading(false);
        setRefreshing(false);

        // Cache chats locally
        try {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(chatList));
        } catch (e) {
          console.warn('Failed to cache chats:', e);
        }
      },
      (error) => {
        console.error('Error fetching chat list:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribeChats();
  }, [currentUser, authLoading]);

  const handleNewChat = () => {
    router.push('/all-users');
  };

  const openChat = (chatId: string) => {
    router.push(`/chat?chatId=${chatId}`);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem(STORAGE_KEY);
      router.replace('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Because onSnapshot handles updates in real-time,
    // just toggling refreshing will suffice.
  }, []);

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

      {(loading || authLoading) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#075E54" />
          <Text>Loading chats...</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
          ListEmptyComponent={
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text>No chats available. Start a new chat!</Text>
            </View>
          }
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
