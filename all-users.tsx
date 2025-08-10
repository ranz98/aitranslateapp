import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';

import { auth, db, appId } from '@/utils/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs, query, where, limit } from 'firebase/firestore';

type AppUser = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

export default function AllUsers() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchUsers();
      } else {
        router.replace('/');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    // Fetch from a public 'users' collection
    const usersRef = collection(db, `/artifacts/${appId}/public/data/users`);
    
    const unsubscribeUsers = onSnapshot(
      usersRef,
      (querySnapshot) => {
        const usersList: AppUser[] = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          if (doc.id !== currentUser?.uid) {
            usersList.push({
              uid: doc.id,
              displayName: userData.displayName,
              photoURL: userData.photoURL,
            });
          }
        });
        setUsers(usersList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching users:', error);
        setLoading(false);
      }
    );

    return () => unsubscribeUsers();
  };

  const handleCreateChat = async (otherUser: AppUser) => {
    if (!currentUser) return;
    try {
      // Key fix: Create a sorted array of members
      const members = [currentUser.uid, otherUser.uid].sort();
      const chatId = members.join('_');

      const chatsRef = collection(db, `/artifacts/${appId}/public/data/chats`);
      // Key fix: Check if a chat with these members already exists
      const q = query(chatsRef, where('members', '==', members), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // If it exists, navigate to the existing chat
        router.push(`/chat?chatId=${querySnapshot.docs[0].id}`);
      } else {
        // If not, create a new chat document with the members array
        const chatName = `${currentUser.displayName} & ${otherUser.displayName}`;
        const newChatDocRef = await addDoc(chatsRef, {
          members: members,
          chatName: chatName,
          lastMessageText: 'New chat created!',
          lastMessageTimestamp: serverTimestamp(),
        });
        router.push(`/chat?chatId=${newChatDocRef.id}`);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start a New Chat</Text>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#075E54" />
          <Text>Loading users...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userItem} onPress={() => handleCreateChat(item)}>
              <Image source={{ uri: item.photoURL || 'https://i.pravatar.cc/150?img=12' }} style={styles.avatar} />
              <Text style={styles.userName}>{item.displayName || 'Unnamed User'}</Text>
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#075E54',
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
