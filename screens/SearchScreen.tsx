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
    SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchParticipants } from '../services/sqlite';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

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
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Participant[]>([]);
    const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 2) {
                const data = await searchParticipants(query);
                setResults(data);
            } else if (query.length === 0) {
                setResults([]);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (participant: Participant) => {
        setSelectedParticipant(participant);
        setModalVisible(true);
    };

    const renderItem = ({ item }: { item: Participant }) => (
        <TouchableOpacity style={styles.card} onPress={() => handleSelect(item)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.subtext}>{item.email}</Text>
            <Text style={styles.subtext}>{item.phone}</Text>
            <View style={styles.badgeContainer}>
                <View style={[styles.badge, styles.eventBadge]}>
                    <Text style={styles.badgeText}>{item.event_id}</Text>
                </View>
                {item.participated > 0 && (
                    <View style={[styles.badge, styles.successBadge]}>
                        <Text style={styles.badgeText}>Participated</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
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
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#FFD700',
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    subtext: {
        color: '#AAA',
        fontSize: 14,
        marginBottom: 2,
    },
    badgeContainer: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    eventBadge: {
        backgroundColor: '#333',
    },
    successBadge: {
        backgroundColor: '#006400',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 12,
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
