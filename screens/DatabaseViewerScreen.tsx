import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAllParticipants } from '../services/sqlite';

// Define the Participant type matching the SQLite schema
// Define the Participant type matching the SQLite schema
type Participant = {
    uid: string;
    event_id: string;
    name: string;
    phone: string;
    email: string;
    checked_in: number;
    checkin_time: string | null;
    source: string;
    sync_status: number;
};

type GroupedParticipant = {
    id: string; // email or unique key
    name: string;
    email: string;
    phone: string;
    events: Participant[];
    expanded: boolean;
};

export default function DatabaseViewerScreen() {
    const [groupedUsers, setGroupedUsers] = useState<GroupedParticipant[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const groupData = (data: Participant[]) => {
        const groups: { [key: string]: GroupedParticipant } = {};

        data.forEach(p => {
            // Use email as primary key, fallback to name if email is missing
            const key = p.email || p.name;

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    name: p.name,
                    email: p.email,
                    phone: p.phone,
                    events: [],
                    expanded: false
                };
            }
            groups[key].events.push(p);
        });

        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    };

    const loadData = async () => {
        try {
            const data = await getAllParticipants();
            console.log('📊 RAW DATABASE DUMP:', JSON.stringify(data, null, 2));
            setGroupedUsers(groupData(data));
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

    const toggleExpand = (id: string) => {
        setGroupedUsers(prev => prev.map(user =>
            user.id === id ? { ...user, expanded: !user.expanded } : user
        ));
    };

    const renderItem = ({ item }: { item: GroupedParticipant }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => toggleExpand(item.id)}
            activeOpacity={0.8}
        >
            {/* Header: User Info */}
            <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                    <Text style={styles.metaPhone}>{item.phone} • {item.events.length} Events</Text>
                </View>
                <Text style={styles.expandIcon}>{item.expanded ? '▲' : '▼'}</Text>
            </View>

            {/* Expanded Content: Event List */}
            {item.expanded && (
                <View style={styles.eventsList}>
                    {item.events.map((event, index) => (
                        <View key={`${event.uid}-${event.event_id}-${index}`} style={[
                            styles.eventItem,
                            index === item.events.length - 1 && styles.lastEventItem
                        ]}>
                            <View style={styles.row}>
                                <Text style={styles.eventTitle}>{event.event_id}</Text>
                                <View style={[
                                    styles.badge,
                                    event.checked_in ? styles.badgeChecked : styles.badgeUnchecked
                                ]}>
                                    <Text style={styles.badgeText}>
                                        {event.checked_in ? 'Verified' : 'Pending'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.detail}>UID: {event.uid}</Text>
                            <Text style={styles.meta}>
                                Source: {event.source} • Sync: {event.sync_status ? 'Synced' : 'Pending'}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>All Participants ({groupedUsers.length})</Text>
            <FlatList
                data={groupedUsers}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
                }
                ListEmptyComponent={<Text style={styles.emptyText}>No synced data found.</Text>}
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
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden'
    },
    cardHeader: {
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1a1a1a'
    },
    userInfo: {
        flex: 1
    },
    expandIcon: {
        color: '#FFD700',
        fontSize: 18,
        paddingLeft: 10
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4
    },
    email: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 2
    },
    metaPhone: {
        color: '#888',
        fontSize: 12
    },
    eventsList: {
        backgroundColor: '#111',
        borderTopWidth: 1,
        borderTopColor: '#333'
    },
    eventItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    lastEventItem: {
        borderBottomWidth: 0
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5
    },
    eventTitle: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: '600'
    },
    detail: {
        color: '#aaa',
        fontSize: 12,
        marginBottom: 2
    },
    meta: {
        color: '#666',
        fontSize: 10,
        fontStyle: 'italic'
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 50
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        marginLeft: 8
    },
    badgeChecked: {
        backgroundColor: '#006400'
    },
    badgeUnchecked: {
        backgroundColor: '#8B0000'
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    }
});
