import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    Modal,
    ScrollView,
    SafeAreaView,
    Platform,
    StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchParticipants } from '../services/sqlite';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useEventContext } from '../navigation/EventContext';

// Define the Participant type
type Participant = {
    uid: string;
    event_id: string;
    name: string;
    phone: string;
    email: string;
    college: string;
    degree: string;
    department: string;
    year: string;
    checkin_time: string | null;
    source: string;
    sync_status: number;
    payment_verified: number;
    participated: number;
    team_name?: string;
    event_type?: string;
};

type Props = {
    navigation: StackNavigationProp<RootStackParamList>;
};

export default function SearchScreen({ navigation }: Props) {
    const { eventContext } = useEventContext();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Participant[]>([]);
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 2) {
                // If admin is SUPER ADMIN, fetch all. Otherwise filtered by event.
                // UNLESS user wants "Logged in event" strictly.
                // Assuming "admin@zorphix.com" = Super Admin (ALL)
                // Others = Filtered.
                const isSuperAdmin = eventContext?.adminEmail === 'admin@zorphix.com';
                const filterEvent = isSuperAdmin ? 'ALL' : (eventContext?.eventName || 'ALL');

                const data = await searchParticipants(query, filterEvent);
                setResults(data);
            } else if (query.length === 0) {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, eventContext]);

    const handleSelect = (participant: Participant) => {
        setSelectedParticipant(participant);
        setModalVisible(true);
    };

    const renderItem = ({ item }: { item: Participant }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)} activeOpacity={0.8}>
            <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.email}>{item.email}</Text>
                    <Text style={styles.metaPhone}>{item.phone}</Text>
                </View>
                <View style={styles.badgeColumn}>
                    <View style={[styles.badge, styles.eventBadge]}>
                        <Text style={styles.badgeText}>{item.event_id}</Text>
                    </View>
                    {item.participated > 0 ? (
                        <View style={[styles.badge, styles.badgeChecked]}>
                            <Text style={styles.badgeText}>Checked In</Text>
                        </View>
                    ) : (
                        <View style={[styles.badge, styles.badgeUnchecked]}>
                            <Text style={styles.badgeText}>Pending</Text>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFD700" />
                </TouchableOpacity>
                <Text style={styles.title}>Search Participants</Text>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Name, Email, or Phone..."
                    placeholderTextColor="#666"
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#666" />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={results}
                renderItem={renderItem}
                keyExtractor={(item) => `${item.uid}-${item.event_id}`}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    query.length > 2 ? (
                        <Text style={styles.emptyText}>No participants found.</Text>
                    ) : (
                        <Text style={styles.emptyText}>Type at least 3 characters to search.</Text>
                    )
                }
            />

            {/* Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Participant Details</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {selectedParticipant && (
                            <ScrollView>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Name</Text>
                                    <Text style={styles.value}>{selectedParticipant.name}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Event</Text>
                                    <Text style={styles.valueHighlight}>{selectedParticipant.event_id}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Email</Text>
                                    <Text style={styles.value}>{selectedParticipant.email}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Phone</Text>
                                    <Text style={styles.value}>{selectedParticipant.phone}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>College</Text>
                                    <Text style={styles.value}>{selectedParticipant.college || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Department</Text>
                                    <Text style={styles.value}>{selectedParticipant.department || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Year</Text>
                                    <Text style={styles.value}>{selectedParticipant.year || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Source</Text>
                                    <Text style={styles.value}>{selectedParticipant.source}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.label}>Status</Text>
                                    <Text style={[styles.value, selectedParticipant.participated > 0 ? styles.textSuccess : styles.textPending]}>
                                        {selectedParticipant.participated > 0
                                            ? `Checked In (${selectedParticipant.checkin_time ? new Date(selectedParticipant.checkin_time).toLocaleTimeString() : ''})`
                                            : 'Not Checked In'}
                                    </Text>
                                </View>

                                {selectedParticipant.team_name && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.label}>Team</Text>
                                        <Text style={styles.value}>{selectedParticipant.team_name}</Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 50, // Safe Area Fix
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        padding: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700',
        marginLeft: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        margin: 16,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        color: '#FFF',
        fontSize: 16,
    },
    list: {
        padding: 16,
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
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    email: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 2,
    },
    metaPhone: {
        color: '#888',
        fontSize: 12,
    },
    badgeColumn: {
        alignItems: 'flex-end',
        gap: 6
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    eventBadge: {
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#444'
    },
    badgeChecked: {
        backgroundColor: '#006400',
    },
    badgeUnchecked: {
        backgroundColor: '#8B0000',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        height: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700',
    },
    detailRow: {
        marginBottom: 16,
    },
    label: {
        color: '#666',
        fontSize: 12,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    value: {
        color: '#FFF',
        fontSize: 16,
    },
    valueHighlight: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: 'bold',
    },
    textSuccess: {
        color: '#00FF00',
        fontWeight: 'bold',
    },
    textPending: {
        color: '#FFA500',
    }
});
