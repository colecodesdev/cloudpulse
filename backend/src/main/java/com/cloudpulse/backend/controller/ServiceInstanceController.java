package com.cloudpulse.backend.controller;

import com.cloudpulse.backend.model.ServiceInstance;
import com.cloudpulse.backend.repo.ServiceInstanceRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ServiceInstanceController {

    private final ServiceInstanceRepository repo;

    public ServiceInstanceController(ServiceInstanceRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/api/services")
    public List<ServiceInstance> list() {
        return repo.findAll();
    }

    @PostMapping("/api/services")
    public ServiceInstance create(@RequestBody ServiceInstance input) {
        ServiceInstance s = new ServiceInstance();
        s.setName(input.getName());
        s.setEnvironment(input.getEnvironment());
        s.setStatus(input.getStatus());
        return repo.save(s);
    }
}
