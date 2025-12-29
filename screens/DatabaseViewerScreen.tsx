import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getUsers, User } from '../services/Database';

export default function DatabaseViewerScreen() {
    const [users, setUsers] = useState<User[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const data = await getUsers();
            // @ts-ignore - DB types mismatch handling
            setUsers(data);
        } catch (error) {
            console.error(error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, []);

    const renderItem = ({ item }: { item: User }) => (
        <View style={styles.card}>
            <View style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.detail}>{item.email}</Text>
            <Text style={styles.detail}>{item.phone}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Registered Users</Text>
            <FlatList
                data={users}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
                }
                ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
        padding: 20
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 20
    },
    list: {
        paddingBottom: 20
    },
    card: {
        backgroundColor: '#111',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: '#FFD700'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white'
    },
    time: {
        fontSize: 12,
        color: '#888'
    },
    detail: {
        color: '#ccc',
        fontSize: 14
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 50
    }
});
