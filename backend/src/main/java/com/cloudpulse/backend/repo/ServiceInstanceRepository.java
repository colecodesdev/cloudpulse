package com.cloudpulse.backend.repo;

import com.cloudpulse.backend.model.ServiceInstance;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ServiceInstanceRepository extends JpaRepository<ServiceInstance, Long> {
}
