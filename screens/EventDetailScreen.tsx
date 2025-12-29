import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

type EventDetailScreenRouteProp = RouteProp<RootStackParamList, 'EventDetail'>;
type EventDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EventDetail'>;

type Props = {
    route: EventDetailScreenRouteProp;
    navigation: EventDetailScreenNavigationProp;
};

const EventDetailScreen: React.FC<Props> = ({ route, navigation }) => {
    const { event } = route.params;

    const handleScanQR = () => {
        navigation.navigate('QRScanner');
    };

    const handleRegister = () => {
        navigation.navigate('Registration');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            <View style={styles.headerSection}>
                <Text style={styles.title}>{event.title}</Text>
                <Text style={styles.date}>{event.date}</Text>
                <View style={styles.categoryContainer}>
                    <Text style={styles.categoryLabel}>Category: </Text>
                    <Text style={styles.categoryValue}>{event.category}</Text>
                </View>
            </View>

            <View style={styles.descriptionSection}>
                <Text style={styles.sectionHeader}>About Event</Text>
                <Text style={styles.description}>{event.description}</Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity style={[styles.button, styles.scanButton]} onPress={handleScanQR}>
                    <Text style={styles.scanButtonText}>Scan QR</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, styles.registerButton]} onPress={handleRegister}>
                    <Text style={styles.registerButtonText}>Register New</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    headerSection: {
        marginBottom: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 10,
    },
    date: {
        fontSize: 16,
        color: '#AAA',
        marginBottom: 10,
    },
    categoryContainer: {
        flexDirection: 'row',
    },
    categoryLabel: {
        fontWeight: '600',
        color: '#FFF',
    },
    categoryValue: {
        color: '#FFD700',
        fontWeight: '600',
    },
    descriptionSection: {
        marginBottom: 40,
    },
    sectionHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 15,
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        color: '#DDD',
    },
    buttonContainer: {
        gap: 15,
    },
    button: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    scanButton: {
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#FFD700'
    },
    registerButton: {
        backgroundColor: '#FFD700',
    },
    scanButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFD700',
    },
    registerButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000000',
    },
});

export default EventDetailScreen;
